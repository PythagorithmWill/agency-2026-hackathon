import { query, longQuery } from "../db/pool";
import { hasAppTable, forgetAppTable, isUndefinedTable } from "../db/features";
import type {
  ConcentrationReport,
  TemporalSeries,
  ForecastResult,
} from "../types/spending";
import { computeConcentration, type RecipientTotal } from "./concentration";
import { forecastForward } from "./temporal";
import { loadSnapshot } from "./snapshot";

/** Selector for which pool budget to use. */
type Budget = "fast" | "long";
const run = (b: Budget) => (b === "long" ? longQuery : query);

/**
 * Normalise a possibly-Date pg value to an ISO string. The pg driver
 * returns DATE columns as JS Date instances by default; some downstream
 * UI code assumes string and calls .slice() on it. Coerce here so every
 * caller gets a consistent shape.
 */
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  try {
    return new Date(v as string | number).toISOString();
  } catch {
    return null;
  }
}

/**
 * DB-touching aggregation helpers. These produce inputs for the pure
 * analytics modules — they do NOT compute concentration/HHI/forecast
 * themselves (those live in concentration.ts / temporal.ts and are
 * fully unit-tested without a database).
 *
 * Convention: every helper applies the F-3 max-amendment CTE on
 * fed.grants_contributions before aggregating, and the A-13 / A-10 /
 * A-6 landmines on AB sources.
 *
 * All queries are bounded by the 8s pool query_timeout.
 */

/* ─── shared CTE fragments ───────────────────────────────────────── */

/**
 * F-3 max-amendment CTE. `innerFilter` is appended to the WHERE clause
 * of the DISTINCT ON scan. ONLY push a predicate inside when it is a
 * function of the partition key — i.e. `recipient_business_number = X`.
 * Because the key's second component is COALESCE(bn, name, _id), every
 * row of a partition whose bn = X has bn = X, so pre-filtering on bn
 * leaves those partitions intact and the winning row unchanged.
 * Predicates on owner_org_title / prog_name_en / dates are NOT safe to
 * push (they are not part of the key and can differ across amendments).
 */
function fedCurrentCte(innerFilter = ""): string {
  return `
  WITH agreement_current AS (
    SELECT DISTINCT ON (
      ref_number,
      COALESCE(recipient_business_number, recipient_legal_name, _id::text)
    )
      ref_number,
      recipient_legal_name,
      recipient_business_number,
      recipient_province,
      owner_org_title,
      prog_name_en,
      agreement_value,
      agreement_start_date,
      description_en
    FROM fed.grants_contributions
    WHERE agreement_value > 0
      AND recipient_legal_name IS NOT NULL${innerFilter}
    ORDER BY
      ref_number,
      COALESCE(recipient_business_number, recipient_legal_name, _id::text),
      NULLIF(amendment_number, '')::int DESC NULLS LAST,
      _id DESC
  )
`;
}
const FED_CURRENT_CTE = fedCurrentCte();

/**
 * Derived-layer fast path. `app.agreement_current` (sql/migrations/
 * 001_canonical.sql, built by scripts/refresh-derived.ts) is the F-3 CTE
 * materialised: one row per F-1 key with the CURRENT value, built from the
 * same base filter (agreement_value > 0 AND recipient_legal_name IS NOT
 * NULL), so every aggregate below is identical to the CTE path — only
 * faster (indexed, no 1.27M-row DISTINCT ON per request). Column map:
 *   agreement_value → current_value · owner_org_title → department ·
 *   prog_name_en → program · recipient_business_number → recipient_bn_raw ·
 *   description_en → description · FED_FY_SQL → fiscal_year ·
 *   COALESCE(bn, name) → recipient_key
 * When the table is absent (or GLASSBOX_DISABLE_APP_TABLES=1) we run the
 * CTE; if it vanishes mid-process (a refresh swap racing a request is
 * harmless, but a dropped table is not) we forget the detection and fall
 * back for this call.
 */
async function withCanonical<T>(fast: () => Promise<T>, slow: () => Promise<T>): Promise<T> {
  if (await hasAppTable("agreement_current")) {
    try {
      return await fast();
    } catch (err) {
      if (!isUndefinedTable(err)) throw err;
      forgetAppTable("agreement_current");
    }
  }
  return slow();
}

/**
 * Federal fiscal year label (Apr 1 – Mar 31, labelled by END year) per
 * agency2026-data-skill "Year alignment convention": a start date of
 * 2023-10-01 is FY2024. Every fy_min / fy_max / fy filter in this module
 * must use this expression — a bare EXTRACT(YEAR …) is a calendar year
 * and is off by one for April–December starts.
 */
export const FED_FY_SQL = `(EXTRACT(YEAR FROM agreement_start_date::date)::int +
         CASE WHEN EXTRACT(MONTH FROM agreement_start_date::date) >= 4 THEN 1 ELSE 0 END)`;

/* ─── corpus as-of date ──────────────────────────────────────────── */

let corpusAsOfCache: { value: string; fetchedAt: number } | null = null;
const CORPUS_AS_OF_TTL_MS = 60 * 60 * 1000;

/**
 * "Data current as of" date for proof tokens: the latest
 * agreement_start_date in the federal corpus that is not in the future
 * (publishers file forward-dated agreements; the max start date alone
 * reads 2027). Served from idx_fed_gc_start_date (backward index scan,
 * ~1ms) and memoised for an hour because it only moves on a corpus
 * refresh. Falls back to the analytics snapshot's generation date, then
 * to a literal "unknown" — never to a hard-coded date.
 */
export async function loadCorpusAsOfDate(): Promise<string> {
  if (corpusAsOfCache && Date.now() - corpusAsOfCache.fetchedAt < CORPUS_AS_OF_TTL_MS) {
    return corpusAsOfCache.value;
  }
  try {
    const r = await query<{ as_of: string | Date | null }>(
      `SELECT MAX(agreement_start_date)::text AS as_of
         FROM fed.grants_contributions
        WHERE agreement_start_date <= CURRENT_DATE`,
    );
    const iso = toIsoOrNull(r.rows[0]?.as_of);
    if (iso) {
      const value = iso.slice(0, 10);
      corpusAsOfCache = { value, fetchedAt: Date.now() };
      return value;
    }
  } catch (err) {
    console.warn("[corpusAsOf] query failed, falling back to snapshot:", (err as Error).message);
  }
  const snap = await loadSnapshot();
  if (snap?.generatedAt) return `${snap.generatedAt.slice(0, 10)} (analytics snapshot)`;
  return "unknown";
}

/* ─── overview-level stats ───────────────────────────────────────── */

export interface OverviewStats {
  totalSpendFed: number;
  agreementCountFed: number;
  recipientCountFed: number;
  departmentCountFed: number;
  programCountFed: number;
  fyRangeFed: { start: number; end: number };
  /**
   * Corpus-level facts used in site copy ("1.27M federal records…").
   * Optional so snapshots built before 2026-09-24 still load; the UI
   * falls back to lib/analytics/corpusStats.ts constants when absent.
   */
  corpus?: CorpusFacts;
}

export interface CorpusFacts {
  fedRows: number;
  abGrantsRows: number;
  abContractsRows: number;
  goldenRecords: number;
  /** Current-agreement federal value with no English description on file. */
  noDescriptionSpendFed: number;
}

export async function loadCorpusFacts(budget: Budget = "long"): Promise<CorpusFacts> {
  const [counts, noDesc] = await Promise.all([
    run(budget)<{ fed: string; abg: string; abc: string; golden: string }>(
      `SELECT (SELECT COUNT(*) FROM fed.grants_contributions)        AS fed,
              (SELECT COUNT(*) FROM ab.ab_grants)                     AS abg,
              (SELECT COUNT(*) FROM ab.ab_contracts)                  AS abc,
              (SELECT COUNT(*) FROM general.entity_golden_records)    AS golden`,
    ),
    withCanonical(
      () =>
        run(budget)<{ total: string | number | null }>(
          `SELECT SUM(current_value)::numeric AS total
             FROM app.agreement_current
            WHERE current_value >= 1
              AND (description IS NULL OR btrim(description) = '')`,
        ),
      () =>
        run(budget)<{ total: string | number | null }>(
          `${FED_CURRENT_CTE}
           SELECT SUM(agreement_value)::numeric AS total
             FROM agreement_current
            WHERE agreement_value >= 1
              AND (description_en IS NULL OR btrim(description_en) = '')`,
        ),
    ),
  ]);
  const c = counts.rows[0];
  return {
    fedRows: Number(c?.fed) || 0,
    abGrantsRows: Number(c?.abg) || 0,
    abContractsRows: Number(c?.abc) || 0,
    goldenRecords: Number(c?.golden) || 0,
    noDescriptionSpendFed: Number(noDesc.rows[0]?.total) || 0,
  };
}

export async function loadOverviewStats(budget: Budget = "fast"): Promise<OverviewStats> {
  type Row = {
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
    department_count: string | number | null;
    program_count: string | number | null;
    fy_min: string | number | null;
    fy_max: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT recipient_key) AS recipient_count,
           COUNT(DISTINCT department) AS department_count,
           COUNT(DISTINCT program) AS program_count,
           MIN(fiscal_year) AS fy_min,
           MAX(fiscal_year) AS fy_max
         FROM app.agreement_current
         WHERE current_value >= 1`,
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count,
           COUNT(DISTINCT owner_org_title) AS department_count,
           COUNT(DISTINCT prog_name_en) AS program_count,
           MIN(${FED_FY_SQL}) AS fy_min,
           MAX(${FED_FY_SQL}) AS fy_max
         FROM agreement_current
         WHERE agreement_value >= 1`,
      ),
  );
  const row = r.rows[0] ?? {
    total: 0,
    agreement_count: 0,
    recipient_count: 0,
    department_count: 0,
    program_count: 0,
    fy_min: 0,
    fy_max: 0,
  };
  let corpus: CorpusFacts | undefined;
  try {
    corpus = await loadCorpusFacts(budget);
  } catch (err) {
    console.warn("[overview] corpus facts unavailable:", (err as Error).message);
  }
  return {
    corpus,
    totalSpendFed: Number(row.total) || 0,
    agreementCountFed: Number(row.agreement_count) || 0,
    recipientCountFed: Number(row.recipient_count) || 0,
    departmentCountFed: Number(row.department_count) || 0,
    programCountFed: Number(row.program_count) || 0,
    fyRangeFed: {
      start: Number(row.fy_min) || 0,
      end: Number(row.fy_max) || 0,
    },
  };
}

/* ─── recipient totals + concentration ───────────────────────────── */

/**
 * Pull the top-N recipients by total federal spend, optionally
 * filtered by department or fiscal-year window. Returns enough rows
 * for `computeConcentration` to produce a representative HHI/Gini
 * (defaults to 5,000 — well above the typical bend in the curve).
 */
export async function loadRecipientTotalsFed({
  limit = 5000,
  department,
  fyStart,
  fyEnd,
  budget = "fast",
}: {
  limit?: number;
  department?: string | null;
  fyStart?: number | null;
  fyEnd?: number | null;
  budget?: Budget;
} = {}): Promise<RecipientTotal[]> {
  const params: unknown[] = [];
  const filters: string[] = ["agreement_value >= 1"];
  const fastFilters: string[] = ["current_value >= 1"];

  if (department) {
    params.push(department);
    filters.push(`(owner_org_title = $${params.length} OR owner_org_title ILIKE $${params.length} || '%')`);
    fastFilters.push(`(department = $${params.length} OR department ILIKE $${params.length} || '%')`);
  }
  if (fyStart) {
    params.push(fyStart);
    filters.push(`${FED_FY_SQL} >= $${params.length}`);
    fastFilters.push(`fiscal_year >= $${params.length}`);
  }
  if (fyEnd) {
    params.push(fyEnd);
    filters.push(`${FED_FY_SQL} <= $${params.length}`);
    fastFilters.push(`fiscal_year <= $${params.length}`);
  }
  params.push(limit);

  type Row = {
    recipient: string | null;
    bn: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           recipient_legal_name AS recipient,
           recipient_bn_raw AS bn,
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM app.agreement_current
         WHERE ${fastFilters.join(" AND ")}
         GROUP BY recipient_legal_name, recipient_bn_raw
         ORDER BY total DESC
         LIMIT $${params.length}`,
        params,
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           recipient_legal_name AS recipient,
           recipient_business_number AS bn,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM agreement_current
         WHERE ${filters.join(" AND ")}
         GROUP BY recipient_legal_name, recipient_business_number
         ORDER BY total DESC
         LIMIT $${params.length}`,
        params,
      ),
  );

  return r.rows
    .map((row) => ({
      recipient: row.recipient ?? "—",
      bn: row.bn ?? null,
      total: Number(row.total) || 0,
      agreementCount: Number(row.agreement_count) || 0,
    }))
    .filter((t) => t.recipient !== "—" && t.total > 0);
}

export async function loadConcentrationFed(opts: {
  department?: string | null;
  fyStart?: number | null;
  fyEnd?: number | null;
  limit?: number;
  budget?: Budget;
} = {}): Promise<ConcentrationReport> {
  // 2,500 captures the long-tail bend within the 8s fast-pool budget.
  // The build-snapshot pipeline runs with budget: "long" + limit: 25_000
  // to capture the full corpus distribution.
  const totals = await loadRecipientTotalsFed({
    limit: opts.limit ?? 2_500,
    department: opts.department,
    fyStart: opts.fyStart,
    fyEnd: opts.fyEnd,
    budget: opts.budget ?? "fast",
  });
  return computeConcentration(totals);
}

/* ─── top departments ────────────────────────────────────────────── */

export interface DepartmentTotal {
  department: string;
  total: number;
  agreementCount: number;
  recipientCount: number;
}

export async function loadTopDepartmentsFed(limit = 25, budget: Budget = "fast"): Promise<DepartmentTotal[]> {
  type Row = {
    department: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT department, total, agreement_count, recipient_count
           FROM app.department_rollup
          ORDER BY total DESC
          LIMIT $1`,
        [limit],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           owner_org_title AS department,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count
         FROM agreement_current
         WHERE owner_org_title IS NOT NULL
         GROUP BY owner_org_title
         ORDER BY total DESC
         LIMIT $1`,
        [limit],
      ),
  );
  return r.rows.map((row) => ({
    department: row.department ?? "—",
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
    recipientCount: Number(row.recipient_count) || 0,
  }));
}

/* ─── top programs ───────────────────────────────────────────────── */

export interface ProgramTotal {
  program: string;
  department: string;
  total: number;
  agreementCount: number;
  recipientCount: number;
}

export async function loadTopProgramsFed(limit = 25, budget: Budget = "fast"): Promise<ProgramTotal[]> {
  type Row = {
    program: string | null;
    department: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT program, department, total, agreement_count, recipient_count
           FROM app.program_rollup
          ORDER BY total DESC
          LIMIT $1`,
        [limit],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           prog_name_en AS program,
           owner_org_title AS department,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count
         FROM agreement_current
         WHERE prog_name_en IS NOT NULL
         GROUP BY prog_name_en, owner_org_title
         ORDER BY total DESC
         LIMIT $1`,
        [limit],
      ),
  );
  return r.rows.map((row) => ({
    program: row.program ?? "—",
    department: row.department ?? "—",
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
    recipientCount: Number(row.recipient_count) || 0,
  }));
}

/* ─── geographic spend by province ───────────────────────────────── */

export interface ProvinceTotal {
  province: string;
  total: number;
  agreementCount: number;
  recipientCount: number;
}

export async function loadProvinceTotalsFed(budget: Budget = "fast"): Promise<ProvinceTotal[]> {
  type Row = {
    province: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           recipient_province AS province,
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT recipient_key) AS recipient_count
         FROM app.agreement_current
         WHERE recipient_province IS NOT NULL
         GROUP BY recipient_province
         ORDER BY total DESC`,
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           recipient_province AS province,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count
         FROM agreement_current
         WHERE recipient_province IS NOT NULL
         GROUP BY recipient_province
         ORDER BY total DESC`,
      ),
  );
  return r.rows.map((row) => ({
    province: row.province ?? "—",
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
    recipientCount: Number(row.recipient_count) || 0,
  }));
}

/* ─── temporal series + forecast ─────────────────────────────────── */

export async function loadTemporalSeriesFed(opts: {
  department?: string | null;
  recipientBn?: string | null;
  budget?: Budget;
} = {}): Promise<TemporalSeries> {
  const params: unknown[] = [];
  const filters: string[] = [
    "agreement_value >= 1",
    "agreement_start_date IS NOT NULL",
  ];
  const fastFilters: string[] = ["current_value >= 1", "fiscal_year IS NOT NULL"];
  if (opts.department) {
    params.push(opts.department);
    filters.push(`(owner_org_title = $${params.length} OR owner_org_title ILIKE $${params.length} || '%')`);
    fastFilters.push(`(department = $${params.length} OR department ILIKE $${params.length} || '%')`);
  }
  // The BN predicate is pushed INSIDE the F-3 CTE (see fedCurrentCte):
  // it is a function of the partition key so the result is identical,
  // but the DISTINCT ON sort runs over ~400 rows instead of 1.26M
  // (measured 4.3–5.8s → sub-second for BN 108162330).
  let innerFilter = "";
  if (opts.recipientBn) {
    params.push(opts.recipientBn);
    innerFilter = ` AND recipient_business_number = $${params.length}`;
    filters.push(`recipient_business_number = $${params.length}`);
    fastFilters.push(`recipient_bn_raw = $${params.length}`);
  }

  type Row = {
    fy: string | number | null;
    total: string | number | null;
    recipient_count: string | number | null;
    program_count: string | number | null;
    agreement_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(opts.budget ?? "fast")<Row>(
        `SELECT
           fiscal_year AS fy,
           SUM(current_value)::numeric AS total,
           COUNT(DISTINCT recipient_key) AS recipient_count,
           COUNT(DISTINCT program) AS program_count,
           COUNT(*) AS agreement_count
         FROM app.agreement_current
         WHERE ${fastFilters.join(" AND ")}
         GROUP BY 1
         ORDER BY 1`,
        params,
      ),
    () =>
      run(opts.budget ?? "fast")<Row>(
        `${fedCurrentCte(innerFilter)}
         SELECT
           ${FED_FY_SQL} AS fy,
           SUM(agreement_value)::numeric AS total,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count,
           COUNT(DISTINCT prog_name_en) AS program_count,
           COUNT(*) AS agreement_count
         FROM agreement_current
         WHERE ${filters.join(" AND ")}
         GROUP BY 1
         ORDER BY 1`,
        params,
      ),
  );

  const points = r.rows
    .map((row) => ({
      fy: Number(row.fy) || 0,
      total: Number(row.total) || 0,
      recipientCount: Number(row.recipient_count) || 0,
      programCount: Number(row.program_count) || 0,
      agreementCount: Number(row.agreement_count) || 0,
    }))
    .filter((p) => p.fy >= 2000 && p.fy <= 2100);

  return {
    bySeries: opts.department
      ? `Federal spend · ${opts.department}`
      : opts.recipientBn
        ? `Federal spend · BN ${opts.recipientBn}`
        : "Federal spend · all",
    points,
  };
}

export async function loadForecastFed(opts: {
  department?: string | null;
  forwardYears?: number;
  budget?: Budget;
} = {}): Promise<ForecastResult | null> {
  const series = await loadTemporalSeriesFed({
    department: opts.department,
    budget: opts.budget ?? "fast",
  });
  if (series.points.length < 4) return null;
  return forecastForward(
    series.points.map((p) => ({ fy: p.fy, value: p.total })),
    opts.forwardYears ?? 3,
  );
}

/* ─── recent high-value agreements (for "recent activity" widget) ── */

export interface RecentAgreement {
  recordId: string;
  recipient: string;
  department: string;
  program: string | null;
  value: number;
  startDate: string | null;
  province: string | null;
}

export async function loadRecentLargeFed(
  minAmount = 5_000_000,
  limit = 20,
  budget: Budget = "fast",
): Promise<RecentAgreement[]> {
  type Row = {
    ref_number: string | null;
    recipient_legal_name: string | null;
    owner_org_title: string | null;
    prog_name_en: string | null;
    agreement_value: string | number | null;
    agreement_start_date: string | null;
    recipient_province: string | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           ref_number, recipient_legal_name, department AS owner_org_title, program AS prog_name_en,
           current_value AS agreement_value, agreement_start_date, recipient_province
         FROM app.agreement_current
         WHERE current_value >= $1
           AND agreement_start_date IS NOT NULL
         ORDER BY agreement_start_date DESC
         LIMIT $2`,
        [minAmount, limit],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           ref_number, recipient_legal_name, owner_org_title, prog_name_en,
           agreement_value, agreement_start_date, recipient_province
         FROM agreement_current
         WHERE agreement_value >= $1
           AND agreement_start_date IS NOT NULL
         ORDER BY agreement_start_date::date DESC
         LIMIT $2`,
        [minAmount, limit],
      ),
  );
  return r.rows.map((row) => ({
    recordId: row.ref_number ?? "",
    recipient: row.recipient_legal_name ?? "—",
    department: row.owner_org_title ?? "—",
    program: row.prog_name_en ?? null,
    value: Number(row.agreement_value) || 0,
    startDate: toIsoOrNull(row.agreement_start_date),
    province: row.recipient_province,
  }));
}

/* ─── amendment-growth scan (for "recent flags" panel) ───────────── */

export interface AmendmentGrowthRow {
  refNumber: string;
  recipient: string;
  department: string;
  initialValue: number;
  currentValue: number;
  growthPercent: number;
  amendmentCount: number;
}

/**
 * Scan recent amendment chains where current/initial growth ≥ 200%
 * and at least 2 amendments. Capped to the top N by current value.
 *
 * Pure SQL window aggregation rather than per-record fetch + JS loop.
 *
 * Chains are partitioned by the F-1 key (ref_number, COALESCE(bn,
 * legal_name, _id)) — the same key the F-3 CTE uses — because
 * ref_number alone collides across unrelated recipients (41K cases).
 * Partitioning by ref_number only produced e.g. GC-2018-Q4-00021 as
 * "$1.3M → $371M, ×286" when the rows belong to three different
 * recipients, and emitted the same agreement three times when the
 * recipient's name was spelled differently across amendments.
 * Recipient / department are taken from the latest amendment row.
 */
export async function scanAmendmentGrowthFed(
  threshold = 2.0,
  limit = 50,
  budget: Budget = "fast",
): Promise<AmendmentGrowthRow[]> {
  const r = await run(budget)<{
    ref_number: string | null;
    recipient_legal_name: string | null;
    owner_org_title: string | null;
    initial_value: string | number | null;
    current_value: string | number | null;
    amendment_count: string | number | null;
  }>(
    `WITH chain AS (
       SELECT
         ref_number,
         COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
         recipient_legal_name,
         owner_org_title,
         agreement_value,
         NULLIF(amendment_number, '')::int AS amend_n,
         _id
       FROM fed.grants_contributions
       WHERE ref_number IS NOT NULL
         AND agreement_value > 0
     ),
     ranked AS (
       SELECT
         ref_number, recipient_legal_name, owner_org_title, agreement_value, amend_n,
         FIRST_VALUE(agreement_value) OVER w_asc AS initial_value,
         FIRST_VALUE(agreement_value) OVER w_desc AS current_value,
         COUNT(*) OVER (PARTITION BY ref_number, agreement_key) AS amendment_count,
         ROW_NUMBER() OVER w_desc AS rn
       FROM chain
       WINDOW
         w_asc AS (PARTITION BY ref_number, agreement_key
                   ORDER BY amend_n ASC NULLS FIRST, _id ASC),
         w_desc AS (PARTITION BY ref_number, agreement_key
                    ORDER BY amend_n DESC NULLS LAST, _id DESC)
     )
     SELECT
       ref_number, recipient_legal_name, owner_org_title,
       initial_value, current_value, amendment_count
     FROM ranked
     WHERE rn = 1
       AND amendment_count >= 2
       AND initial_value > 100000
       AND current_value >= initial_value * $1
     ORDER BY current_value DESC
     LIMIT $2`,
    [threshold, limit],
  );

  return r.rows.map((row) => {
    const initial = Number(row.initial_value) || 0;
    const current = Number(row.current_value) || 0;
    return {
      refNumber: row.ref_number ?? "",
      recipient: row.recipient_legal_name ?? "—",
      department: row.owner_org_title ?? "—",
      initialValue: initial,
      currentValue: current,
      growthPercent: initial > 0 ? (current - initial) / initial : 0,
      amendmentCount: Number(row.amendment_count) || 0,
    };
  });
}

/* ─── department × recipient flows for the Sankey ───────────────── */

export interface DeptRecipientFlow {
  department: string;
  recipient: string;
  bn: string | null;
  total: number;
  agreementCount: number;
}

/**
 * Top dept × recipient flows. Used by the Sankey visualization. Limits
 * to the top N departments AND top M recipients per department. Cheap
 * thanks to a one-shot lateral join — the per-department subquery
 * pulls only its top-M recipients, so total rows ≤ N × M.
 *
 * Without the top-N constraint this query would aggregate the full
 * 1.27M-row corpus; with the constraint it scans only the matching
 * groups via the deptList CTE.
 */
export async function loadDeptRecipientFlows(
  topDepartments = 8,
  topRecipientsPerDept = 5,
  budget: Budget = "long",
): Promise<DeptRecipientFlow[]> {
  // F-3 max-amendment current set, then top departments, then top
  // recipients per department. Two-pass aggregation avoids scanning
  // the corpus twice — top_depts identifies the candidate set; the
  // window function picks top-M recipients per department.
  type Row = {
    department: string | null;
    recipient: string | null;
    bn: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  };
  const flowsSql = (source: string) =>
    `WITH agreement_current AS (${source}),
     top_depts AS (
       SELECT owner_org_title AS department,
              SUM(agreement_value)::numeric AS total
         FROM agreement_current
        GROUP BY owner_org_title
        ORDER BY total DESC
        LIMIT $1
     ),
     dept_recip AS (
       SELECT ac.owner_org_title AS department,
              ac.recipient_legal_name AS recipient,
              ac.recipient_business_number AS bn,
              SUM(ac.agreement_value)::numeric AS total,
              COUNT(*) AS agreement_count,
              ROW_NUMBER() OVER (
                PARTITION BY ac.owner_org_title
                ORDER BY SUM(ac.agreement_value) DESC
              ) AS rn
         FROM agreement_current ac
         JOIN top_depts td ON td.department = ac.owner_org_title
        GROUP BY ac.owner_org_title, ac.recipient_legal_name, ac.recipient_business_number
     )
     SELECT department, recipient, bn, total, agreement_count
       FROM dept_recip
      WHERE rn <= $2
      ORDER BY department, total DESC`;
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        flowsSql(`SELECT ref_number, recipient_legal_name, recipient_bn_raw AS recipient_business_number,
                         department AS owner_org_title, current_value AS agreement_value
                    FROM app.agreement_current
                   WHERE department IS NOT NULL`),
        [topDepartments, topRecipientsPerDept],
      ),
    () =>
      run(budget)<Row>(
        flowsSql(`SELECT DISTINCT ON (
                    ref_number,
                    COALESCE(recipient_business_number, recipient_legal_name, _id::text)
                  )
                    ref_number,
                    recipient_legal_name,
                    recipient_business_number,
                    owner_org_title,
                    agreement_value
                  FROM fed.grants_contributions
                  WHERE agreement_value > 0
                    AND recipient_legal_name IS NOT NULL
                    AND owner_org_title IS NOT NULL
                  ORDER BY
                    ref_number,
                    COALESCE(recipient_business_number, recipient_legal_name, _id::text),
                    NULLIF(amendment_number, '')::int DESC NULLS LAST,
                    _id DESC`),
        [topDepartments, topRecipientsPerDept],
      ),
  );
  return r.rows.map((row) => ({
    department: row.department ?? "—",
    recipient: row.recipient ?? "—",
    bn: row.bn ?? null,
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
  }));
}

/* ─── single-entity profile queries (department / recipient) ───── */

export interface DepartmentProfileRow {
  department: string;
  totalSpend: number;
  agreementCount: number;
  recipientCount: number;
  programCount: number;
  fyRange: { start: number; end: number };
}

export async function loadDepartmentProfile(
  department: string,
  budget: Budget = "fast",
): Promise<DepartmentProfileRow | null> {
  type Row = {
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
    program_count: string | number | null;
    fy_min: string | number | null;
    fy_max: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT total, agreement_count, recipient_count, program_count, fy_min, fy_max
           FROM app.department_rollup
          WHERE department = $1`,
        [department],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count,
           COUNT(DISTINCT prog_name_en) AS program_count,
           MIN(${FED_FY_SQL}) AS fy_min,
           MAX(${FED_FY_SQL}) AS fy_max
         FROM agreement_current
         WHERE owner_org_title = $1`,
        [department],
      ),
  );
  const row = r.rows[0];
  if (!row || !row.agreement_count || Number(row.agreement_count) === 0) return null;
  return {
    department,
    totalSpend: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
    recipientCount: Number(row.recipient_count) || 0,
    programCount: Number(row.program_count) || 0,
    fyRange: {
      start: Number(row.fy_min) || 0,
      end: Number(row.fy_max) || 0,
    },
  };
}

export async function loadDepartmentRecipients(
  department: string,
  limit = 25,
  budget: Budget = "fast",
): Promise<RecipientTotal[]> {
  type Row = {
    recipient: string | null;
    bn: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           recipient_legal_name AS recipient,
           recipient_bn_raw AS bn,
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM app.agreement_current
         WHERE department = $1
         GROUP BY recipient_legal_name, recipient_bn_raw
         ORDER BY total DESC
         LIMIT $2`,
        [department, limit],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           recipient_legal_name AS recipient,
           recipient_business_number AS bn,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM agreement_current
         WHERE owner_org_title = $1
         GROUP BY recipient_legal_name, recipient_business_number
         ORDER BY total DESC
         LIMIT $2`,
        [department, limit],
      ),
  );
  return r.rows.map((row) => ({
    recipient: row.recipient ?? "—",
    bn: row.bn ?? null,
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
  }));
}

export async function loadDepartmentPrograms(
  department: string,
  limit = 25,
  budget: Budget = "fast",
): Promise<{ program: string; total: number; agreementCount: number }[]> {
  type Row = {
    program: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT program, total, agreement_count
           FROM app.program_rollup
          WHERE department = $1
          ORDER BY total DESC
          LIMIT $2`,
        [department, limit],
      ),
    () =>
      run(budget)<Row>(
        `${FED_CURRENT_CTE}
         SELECT
           prog_name_en AS program,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM agreement_current
         WHERE owner_org_title = $1 AND prog_name_en IS NOT NULL
         GROUP BY prog_name_en
         ORDER BY total DESC
         LIMIT $2`,
        [department, limit],
      ),
  );
  return r.rows.map((row) => ({
    program: row.program ?? "—",
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
  }));
}

export interface RecipientProfileRow {
  legalName: string;
  bn: string | null;
  province: string | null;
  totalReceived: number;
  agreementCount: number;
  departmentCount: number;
  programCount: number;
  fyRange: { start: number; end: number };
}

/* ─── golden-record lookup for cross-dataset entities ─────────────
   The federal corpus alone misses CRA-only entities (charities) and
   AB-only entities. general.entity_golden_records is the canonical
   cross-dataset reconciliation produced by TRACE — every record links
   its CRA / fed / AB / ab profiles where present.
   ───────────────────────────────────────────────────────────────── */

export interface GoldenRecordSummary {
  id: number;
  canonicalName: string;
  entityType: string | null;
  bnRoot: string | null;
  bnVariants: string[];
  datasetSources: string[];
  sourceSummary: Record<string, number>;
  /** Raw JSON profiles per data source — shape depends on dataset. */
  craProfile: Record<string, unknown> | null;
  fedProfile: Record<string, unknown> | null;
  abProfile: Record<string, unknown> | null;
  addresses: Array<Record<string, unknown>>;
  aliases: Array<Record<string, unknown>>;
  confidence: number;
}

interface GoldenRow {
  id: number;
  canonical_name: string;
  entity_type: string | null;
  bn_root: string | null;
  bn_variants: string[] | null;
  dataset_sources: string[] | null;
  source_summary: Record<string, number> | null;
  cra_profile: Record<string, unknown> | null;
  fed_profile: Record<string, unknown> | null;
  ab_profile: Record<string, unknown> | null;
  addresses: Array<Record<string, unknown>> | null;
  aliases: Array<Record<string, unknown>> | null;
  confidence: string | number | null;
}

export async function loadGoldenRecord(
  identifier: string,
  budget: Budget = "fast",
): Promise<GoldenRecordSummary | null> {
  // identifier may be a full BN ("129253308RR0001", "108162330RT0001")
  // or a 9-digit root ("129253308") or a free-text legal name. Try BN
  // matches first; fall back to canonical_name match. Any CRA program
  // account suffix (RR/RT/RP/RM/RC + 4 digits) is stripped to reach the
  // root — bn_variants on the golden record typically lists only the
  // RR variant, so "108162330RT0001" found nothing when only RR was
  // stripped (verified against the live corpus).
  const bnLooking = /^\d{9,}/.test(identifier);
  const r = await run(budget)<GoldenRow>(
    bnLooking
      ? `SELECT id, canonical_name, entity_type, bn_root, bn_variants,
                dataset_sources, source_summary,
                cra_profile, fed_profile, ab_profile,
                addresses, aliases, confidence
           FROM general.entity_golden_records
          WHERE bn_root = $1
             OR $1 = ANY(bn_variants)
          ORDER BY source_link_count DESC NULLS LAST
          LIMIT 1`
      : `SELECT id, canonical_name, entity_type, bn_root, bn_variants,
                dataset_sources, source_summary,
                cra_profile, fed_profile, ab_profile,
                addresses, aliases, confidence
           FROM general.entity_golden_records
          WHERE canonical_name = $1
             OR norm_name = upper($1)
          ORDER BY source_link_count DESC NULLS LAST
          LIMIT 1`,
    [bnLooking ? identifier.trim().replace(/\s*[A-Z]{2}\s*\d{4}$/i, "") : identifier],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    entityType: row.entity_type,
    bnRoot: row.bn_root,
    bnVariants: row.bn_variants ?? [],
    datasetSources: row.dataset_sources ?? [],
    sourceSummary: row.source_summary ?? {},
    craProfile: row.cra_profile,
    fedProfile: row.fed_profile,
    abProfile: row.ab_profile,
    addresses: row.addresses ?? [],
    aliases: row.aliases ?? [],
    confidence: Number(row.confidence) || 0,
  };
}

/**
 * Recipient lookup by BN. The corpus uses recipient_business_number as
 * the canonical identifier; recipient_legal_name varies (translation,
 * publisher reformatting). We accept both: if the input parses as a
 * BN we filter on BN, otherwise we filter on the legal name.
 */
/**
 * Recipient lookup. Filters BY recipient FIRST, then applies the F-3
 * max-amendment dedup on the small filtered set. This way we don't
 * dedup the entire 1.27M-row corpus just to look up one entity.
 *
 * Switched to longQuery: even with the filter-first optimization,
 * recipients with hundreds of agreements (universities, large NGOs)
 * can take 5–10s. Acceptable for an interactive detail page.
 */
function recipientFilterClause(identifier: string): {
  clause: string;
  /** Same predicate against app.agreement_current column names. */
  fastClause: string;
  params: unknown[];
} {
  const isBn = /^\d{9,}/.test(identifier);
  // Name lookups: the live corpus has a btree on
  // upper(trim(recipient_legal_name)) (idx_fed_gc_upper_trim_name) but
  // none on the raw column. The upper/trim equality is implied by the
  // exact equality, so AND-ing it changes nothing about the result set
  // while letting the planner use the index instead of a 1.27M-row seq
  // scan. There is no index on recipient_business_number at all.
  return {
    clause: isBn
      ? "recipient_business_number = $1"
      : "recipient_legal_name = $1 AND upper(trim(recipient_legal_name)) = upper(trim($1))",
    fastClause: isBn ? "recipient_bn_raw = $1" : "recipient_legal_name = $1",
    params: [identifier],
  };
}

/**
 * Recipient queries: filter the corpus to the recipient's slice FIRST
 * (BN equality, or the index-backed name equality), then apply the F-3
 * max-amendment DISTINCT ON within that slice. agreement_value is
 * CUMULATIVE per amendment row (F-3: 20.54M → 36.24M → 36.24M restates
 * the running total), so "current commitment" = the latest amendment
 * row per F-1 key — the same definition the overview / department pages
 * use, which makes recipient totals reconcile with them. The earlier
 * `is_amendment = false` shortcut reported the ORIGINAL commitment
 * (BN 108162330: $713.3M vs $737.7M current).
 *
 * For a BN predicate the slice is provably identical to the global CTE
 * (BN is part of the partition key). For a name predicate, agreements
 * whose amendments were filed under a different spelling of the name
 * are seen only through the rows that carry the requested spelling —
 * inherent to a name lookup; BN is the authoritative anchor.
 */
function recipientSliceCte(clause: string): string {
  return `
  WITH slice AS (
    SELECT DISTINCT ON (
      ref_number,
      COALESCE(recipient_business_number, recipient_legal_name, _id::text)
    )
      ref_number,
      recipient_legal_name,
      recipient_business_number,
      recipient_province,
      owner_org_title,
      prog_name_en,
      agreement_value,
      agreement_start_date
    FROM fed.grants_contributions
    WHERE ${clause}
      AND agreement_value > 0
      AND recipient_legal_name IS NOT NULL
    ORDER BY
      ref_number,
      COALESCE(recipient_business_number, recipient_legal_name, _id::text),
      NULLIF(amendment_number, '')::int DESC NULLS LAST,
      _id DESC
  )`;
}

export async function loadRecipientProfile(
  identifier: string,
  budget: Budget = "long",
): Promise<RecipientProfileRow | null> {
  const { clause, fastClause, params } = recipientFilterClause(identifier);
  type Row = {
    legal_name: string | null;
    bn: string | null;
    province: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    department_count: string | number | null;
    program_count: string | number | null;
    fy_min: string | number | null;
    fy_max: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           MAX(recipient_legal_name) AS legal_name,
           MAX(recipient_bn_raw) AS bn,
           MAX(recipient_province) AS province,
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT department) AS department_count,
           COUNT(DISTINCT program) AS program_count,
           MIN(fiscal_year) AS fy_min,
           MAX(fiscal_year) AS fy_max
         FROM app.agreement_current
         WHERE ${fastClause}`,
        params,
      ),
    () =>
      run(budget)<Row>(
        `${recipientSliceCte(clause)}
         SELECT
           MAX(recipient_legal_name) AS legal_name,
           MAX(recipient_business_number) AS bn,
           MAX(recipient_province) AS province,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count,
           COUNT(DISTINCT owner_org_title) AS department_count,
           COUNT(DISTINCT prog_name_en) AS program_count,
           MIN(${FED_FY_SQL}) AS fy_min,
           MAX(${FED_FY_SQL}) AS fy_max
         FROM slice`,
        params,
      ),
  );
  const row = r.rows[0];
  if (!row || !row.agreement_count || Number(row.agreement_count) === 0) return null;
  return {
    legalName: row.legal_name ?? identifier,
    bn: row.bn ?? null,
    province: row.province ?? null,
    totalReceived: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
    departmentCount: Number(row.department_count) || 0,
    programCount: Number(row.program_count) || 0,
    fyRange: {
      start: Number(row.fy_min) || 0,
      end: Number(row.fy_max) || 0,
    },
  };
}

export async function loadRecipientByDepartment(
  identifier: string,
  budget: Budget = "long",
): Promise<{ department: string; total: number; agreementCount: number }[]> {
  const { clause, fastClause, params } = recipientFilterClause(identifier);
  type Row = {
    department: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           department,
           SUM(current_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM app.agreement_current
         WHERE ${fastClause} AND department IS NOT NULL
         GROUP BY department
         ORDER BY total DESC`,
        params,
      ),
    () =>
      run(budget)<Row>(
        `${recipientSliceCte(clause)}
         SELECT
           owner_org_title AS department,
           SUM(agreement_value)::numeric AS total,
           COUNT(*) AS agreement_count
         FROM slice
         WHERE owner_org_title IS NOT NULL
         GROUP BY owner_org_title
         ORDER BY total DESC`,
        params,
      ),
  );
  return r.rows.map((row) => ({
    department: row.department ?? "—",
    total: Number(row.total) || 0,
    agreementCount: Number(row.agreement_count) || 0,
  }));
}

/** Top-N agreements for a recipient by CURRENT (latest-amendment) value, descending. */
export async function loadRecipientAgreements(
  identifier: string,
  limit = 50,
  budget: Budget = "long",
): Promise<RecentAgreement[]> {
  const { clause, fastClause, params } = recipientFilterClause(identifier);
  type Row = {
    ref_number: string | null;
    recipient_legal_name: string | null;
    owner_org_title: string | null;
    prog_name_en: string | null;
    agreement_value: string | number | null;
    agreement_start_date: string | null;
    recipient_province: string | null;
  };
  const r = await withCanonical(
    () =>
      run(budget)<Row>(
        `SELECT
           ref_number, recipient_legal_name, department AS owner_org_title, program AS prog_name_en,
           current_value AS agreement_value, agreement_start_date, recipient_province
         FROM app.agreement_current
         WHERE ${fastClause}
         ORDER BY current_value DESC, agreement_start_date DESC NULLS LAST, ref_number
         LIMIT $2`,
        [...params, limit],
      ),
    () =>
      run(budget)<Row>(
        `${recipientSliceCte(clause)}
         SELECT
           ref_number, recipient_legal_name, owner_org_title, prog_name_en,
           agreement_value, agreement_start_date, recipient_province
         FROM slice
         ORDER BY agreement_value DESC, agreement_start_date DESC NULLS LAST, ref_number
         LIMIT $2`,
        [...params, limit],
      ),
  );
  return r.rows.map((row) => ({
    recordId: row.ref_number ?? "",
    recipient: row.recipient_legal_name ?? "—",
    department: row.owner_org_title ?? "—",
    program: row.prog_name_en ?? null,
    value: Number(row.agreement_value) || 0,
    startDate: toIsoOrNull(row.agreement_start_date),
    province: row.recipient_province,
  }));
}
