import { query, longQuery } from "../db/pool";
import type {
  ConcentrationReport,
  TemporalSeries,
  ForecastResult,
} from "../types/spending";
import { computeConcentration, type RecipientTotal } from "./concentration";
import { forecastForward } from "./temporal";

/** Selector for which pool budget to use. */
type Budget = "fast" | "long";
const run = (b: Budget) => (b === "long" ? longQuery : query);

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

const FED_CURRENT_CTE = `
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
      AND recipient_legal_name IS NOT NULL
    ORDER BY
      ref_number,
      COALESCE(recipient_business_number, recipient_legal_name, _id::text),
      NULLIF(amendment_number, '')::int DESC NULLS LAST,
      _id DESC
  )
`;

/* ─── overview-level stats ───────────────────────────────────────── */

export interface OverviewStats {
  totalSpendFed: number;
  agreementCountFed: number;
  recipientCountFed: number;
  departmentCountFed: number;
  programCountFed: number;
  fyRangeFed: { start: number; end: number };
}

export async function loadOverviewStats(budget: Budget = "fast"): Promise<OverviewStats> {
  const r = await run(budget)<{
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
    department_count: string | number | null;
    program_count: string | number | null;
    fy_min: string | number | null;
    fy_max: string | number | null;
  }>(
    `${FED_CURRENT_CTE}
     SELECT
       SUM(agreement_value)::numeric AS total,
       COUNT(*) AS agreement_count,
       COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count,
       COUNT(DISTINCT owner_org_title) AS department_count,
       COUNT(DISTINCT prog_name_en) AS program_count,
       MIN(EXTRACT(YEAR FROM agreement_start_date::date)) AS fy_min,
       MAX(EXTRACT(YEAR FROM agreement_start_date::date)) AS fy_max
     FROM agreement_current
     WHERE agreement_value >= 1`,
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
  return {
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

  if (department) {
    params.push(department);
    filters.push(`(owner_org_title = $${params.length} OR owner_org_title ILIKE $${params.length} || '%')`);
  }
  if (fyStart) {
    params.push(fyStart);
    filters.push(`EXTRACT(YEAR FROM agreement_start_date::date) >= $${params.length}`);
  }
  if (fyEnd) {
    params.push(fyEnd);
    filters.push(`EXTRACT(YEAR FROM agreement_start_date::date) <= $${params.length}`);
  }
  params.push(limit);

  const r = await run(budget)<{
    recipient: string | null;
    bn: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
  }>(
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
  const r = await run(budget)<{
    department: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  }>(
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
  const r = await run(budget)<{
    program: string | null;
    department: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  }>(
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
  const r = await run(budget)<{
    province: string | null;
    total: string | number | null;
    agreement_count: string | number | null;
    recipient_count: string | number | null;
  }>(
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
  if (opts.department) {
    params.push(opts.department);
    filters.push(`(owner_org_title = $${params.length} OR owner_org_title ILIKE $${params.length} || '%')`);
  }
  if (opts.recipientBn) {
    params.push(opts.recipientBn);
    filters.push(`recipient_business_number = $${params.length}`);
  }

  const r = await run(opts.budget ?? "fast")<{
    fy: string | number | null;
    total: string | number | null;
    recipient_count: string | number | null;
    program_count: string | number | null;
    agreement_count: string | number | null;
  }>(
    `${FED_CURRENT_CTE}
     SELECT
       EXTRACT(YEAR FROM agreement_start_date::date)::int +
         CASE WHEN EXTRACT(MONTH FROM agreement_start_date::date) >= 4 THEN 1 ELSE 0 END
         AS fy,
       SUM(agreement_value)::numeric AS total,
       COUNT(DISTINCT COALESCE(recipient_business_number, recipient_legal_name)) AS recipient_count,
       COUNT(DISTINCT prog_name_en) AS program_count,
       COUNT(*) AS agreement_count
     FROM agreement_current
     WHERE ${filters.join(" AND ")}
     GROUP BY 1
     ORDER BY 1`,
    params,
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
  const r = await run(budget)<{
    ref_number: string | null;
    recipient_legal_name: string | null;
    owner_org_title: string | null;
    prog_name_en: string | null;
    agreement_value: string | number | null;
    agreement_start_date: string | null;
    recipient_province: string | null;
  }>(
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
  );
  return r.rows.map((row) => ({
    recordId: row.ref_number ?? "",
    recipient: row.recipient_legal_name ?? "—",
    department: row.owner_org_title ?? "—",
    program: row.prog_name_en ?? null,
    value: Number(row.agreement_value) || 0,
    startDate: row.agreement_start_date,
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
         FIRST_VALUE(agreement_value) OVER (
           PARTITION BY ref_number
           ORDER BY amend_n ASC NULLS FIRST, _id ASC
         ) AS initial_value,
         FIRST_VALUE(agreement_value) OVER (
           PARTITION BY ref_number
           ORDER BY amend_n DESC NULLS LAST, _id DESC
         ) AS current_value,
         COUNT(*) OVER (PARTITION BY ref_number) AS amendment_count
       FROM chain
     )
     SELECT DISTINCT
       ref_number, recipient_legal_name, owner_org_title,
       initial_value, current_value, amendment_count
     FROM ranked
     WHERE amendment_count >= 2
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
