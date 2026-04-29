import { query, longQuery } from "../db/pool";
import type { ComparableRecord, DatasetSource } from "../types";
import { generateMockComparables } from "./mockComparables";

/**
 * Glassbox retrieval — federal + Alberta provincial sources in parallel.
 *
 * Sources:
 *   - fed.grants_contributions  (F-3 max-amendment CTE; FTS on description_en)
 *   - ab.ab_grants              (A-13 dedupe + A-10 NULL filter + A-6 sign filter;
 *                                FTS on synthetic program||recipient||ministry text)
 *   - ab.ab_contracts           (same A-* guards; FTS on recipient||ministry)
 *
 * Each source query is run independently via Promise.allSettled so a failure
 * on one source does not poison the others. ts_rank_cd returns a per-row
 * relevance score; we max-normalize globally so the UI similarity bars are
 * comparable across sources.
 *
 * Falls back to mockComparables only when EVERY live source returns empty
 * or throws — partial failures degrade gracefully (a SHIPPING_PARTIAL_FALLBACK
 * warning to stderr names the failed source).
 */

const EN_STOPWORDS = new Set([
  "the","a","an","and","or","but","of","for","to","in","on","at","by",
  "with","this","that","will","be","is","are","was","were","been","being",
  "as","it","its","from","into","over","under","across","up","down","out",
  "off","than","then","when","where","while","via","per","each","any","all",
  "some","such","not","no","yes","also","may","can","could","should","would",
  "funding","contribution","program","project","support","provide","deliver",
  "ensure","including","new","amount","year","fiscal","federal","government",
  "canada","canadian","upon","through","during","within","between","without",
  "shall","must","other","these","those","there","here",
  "have","has","had","having","do","does","did","done","make","made","makes",
  "use","used","using","get","got","getting","take","takes","took","taken",
]);

const KEYWORD_RE = /[\p{L}\p{N}]+/gu;

function extractKeywords(text: string, maxN: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.toLowerCase().matchAll(KEYWORD_RE)) {
    const t = m[0];
    // 2-char floor (was 4) so short acronyms like "AI", "ML", "QA"
    // pass through. Stopword filter still drops noise tokens.
    if (t.length < 2 || EN_STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxN) break;
  }
  return out;
}

/**
 * Acronym → expansion map. PostgreSQL's English stemmer treats short
 * acronyms as opaque tokens (so `to_tsquery('english', 'ai')` matches
 * literal "ai" but NOT "artificial intelligence"). For known acronyms
 * we OR the expansion into the tsquery so the search returns what the
 * user expected.
 *
 * Casing is normalized to lower-case; expansions go through the same
 * stemmer at query time.
 */
const ACRONYM_EXPANSIONS: Record<string, string[]> = {
  ai: ["artificial", "intelligence"],
  ml: ["machine", "learning"],
  ev: ["electric", "vehicle"],
  it: ["information", "technology"],
  hr: ["human", "resources"],
  rd: ["research", "development"],
  nlp: ["natural", "language", "processing"],
  iot: ["internet", "things"],
  api: ["application", "programming"],
  qa: ["quality", "assurance"],
  ux: ["user", "experience"],
  vr: ["virtual", "reality"],
  ar: ["augmented", "reality"],
  esg: ["environmental", "social", "governance"],
  csr: ["corporate", "social", "responsibility"],
  ngo: ["non", "governmental", "organization"],
};

function tsqueryFor(draftText: string, workingTitle: string): string {
  const titleKw = extractKeywords(workingTitle, 4);
  const draftKw = extractKeywords(draftText, 10);
  const dedup = Array.from(new Set([...titleKw, ...draftKw])).slice(0, 12);
  const safe = dedup
    .map((k) => k.replace(/[^a-z0-9]/g, ""))
    .filter((k) => k.length >= 2);

  // Expand known acronyms into their long forms so users searching
  // "AI" actually find "artificial intelligence" agreements.
  const expanded = new Set<string>(safe);
  for (const k of safe) {
    const expansion = ACRONYM_EXPANSIONS[k];
    if (expansion) for (const e of expansion) expanded.add(e);
  }

  return Array.from(expanded).join(" | ");
}

function fiscalYearOf(d: Date | string | null): number {
  if (!d) return new Date().getFullYear();
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return new Date().getFullYear();
  return date.getMonth() >= 3 ? date.getFullYear() + 1 : date.getFullYear();
}

function fiscalYearFromAbLabel(label: string | null): number {
  if (!label) return new Date().getFullYear();
  const m = label.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return Number(m[2]);
  const m2 = label.match(/(\d{4})/);
  if (m2) return Number(m2[1]);
  return new Date().getFullYear();
}

const NULL_DEPT_VALUES = new Set([
  "",
  "any",
  "(any)",
  "(any department)",
  "other / not yet assigned",
  "other",
  "not yet assigned",
]);

function normalizeDept(d?: string | null): string | null {
  if (!d) return null;
  const trimmed = d.trim();
  if (NULL_DEPT_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/* ─────────────────────────────────────────────────────────────────────────
   Per-source row shapes + queries
   ───────────────────────────────────────────────────────────────────── */

interface FedRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_province: string | null;
  owner_org_title: string | null;
  prog_name_en: string | null;
  agreement_value: string | number | null;
  agreement_start_date: string | null;
  description_en: string | null;
  rank: string | number;
}

interface AbGrantsRow {
  id: string;
  recipient: string | null;
  program: string | null;
  ministry: string | null;
  amount: string | number | null;
  display_fiscal_year: string | null;
  rank: string | number;
}

interface AbContractsRow {
  id: string;
  recipient: string | null;
  ministry: string | null;
  amount: string | number | null;
  display_fiscal_year: string | null;
  rank: string | number;
}

/** Fed search SQL.
 *
 * Two-stage candidate / dedup pattern:
 *
 *   1. `candidates` ranks rows by ts_rank_cd over the WHOLE corpus
 *      (every is_amendment value), capped to top N by rank. This stays
 *      fast on common short queries because PostgreSQL only sorts the
 *      top-K rows by rank — not the whole match set.
 *
 *   2. The F-3 max-amendment DISTINCT ON is then applied to those
 *      candidates only — picking the latest amendment per ref_number
 *      so users see the current state of each agreement.
 *
 * Net result: searches like "ai" or "research" return current-state
 * agreement records in <2s instead of timing out. The candidate cap is
 * deliberately wider than the requested limit so dedup doesn't starve
 * the result set.
 */
function fedSearchSql({
  withAmountRange,
  withDept,
  limit,
}: {
  withAmountRange: boolean;
  withDept: boolean;
  limit: number;
}): string {
  // For ad-hoc topic searches we drop the floor to $25K so research-scale
  // grants surface (most NSERC / CFI / CIHR awards land between $25K and
  // $250K). The 250K floor only applies in evaluate-a-draft mode where the
  // candidate range is bounded by the user's anticipated amount.
  const amountClause = withAmountRange
    ? "agreement_value BETWEEN $2 AND $3"
    : "agreement_value >= 25000";
  const deptParamIdx = withAmountRange ? 4 : 2;
  const deptClause = withDept
    ? `AND (
          $${deptParamIdx}::text IS NULL
          OR owner_org_title = $${deptParamIdx}
          OR owner_org_title ILIKE $${deptParamIdx} || '%'
        )`
    : "";
  // Cap candidates at 6× the requested limit so the dedup pass has
  // headroom but we never sort more than ~few hundred rows by rank.
  const candidateCap = Math.max(limit * 6, 60);
  return `
    WITH candidates AS (
      SELECT
        ref_number, recipient_legal_name, recipient_business_number,
        recipient_province, owner_org_title, prog_name_en,
        agreement_value, agreement_start_date, description_en,
        amendment_number, _id,
        ts_rank_cd(
          to_tsvector('english', description_en),
          to_tsquery('english', $1),
          32
        ) AS rank
      FROM fed.grants_contributions
      WHERE ${amountClause}
        AND description_en IS NOT NULL
        AND length(description_en) >= 80
        AND to_tsvector('english', description_en) @@ to_tsquery('english', $1)
        ${deptClause}
      ORDER BY rank DESC
      LIMIT ${candidateCap}
    ),
    agreement_current AS (
      SELECT DISTINCT ON (
        ref_number,
        COALESCE(recipient_business_number, recipient_legal_name, _id::text)
      )
        ref_number, recipient_legal_name, recipient_business_number,
        recipient_province, owner_org_title, prog_name_en,
        agreement_value, agreement_start_date, description_en,
        rank
      FROM candidates
      ORDER BY
        ref_number,
        COALESCE(recipient_business_number, recipient_legal_name, _id::text),
        NULLIF(amendment_number, '')::int DESC NULLS LAST,
        _id DESC
    )
    SELECT * FROM agreement_current
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
}

/**
 * AB grants search. ab_grants has no description column, so we synthesize a
 * searchable text from program + recipient + ministry. Landmines:
 *   A-13: DISTINCT ON tuple (ministry, business_unit_name, recipient,
 *         program, amount, payment_date) collapses exact duplicates.
 *   A-10: recipient IS NOT NULL filter drops publisher-aggregated NULL rows.
 *   A-6:  amount > 0 filter drops reversal/correction rows.
 */
function abGrantsSearchSql(
  amountFloor: number,
  withAmountRange: boolean,
  withMinistry: boolean,
  limit: number,
): string {
  // tsq = $1
  // when withAmountRange: minAmount = $2, maxAmount = $3
  // when withMinistry: ministry = $next
  const amountClause = withAmountRange
    ? `amount BETWEEN $2 AND $3`
    : `amount >= ${amountFloor}`;
  const ministryParamIdx = withAmountRange ? 4 : 2;
  const ministryClause = withMinistry
    ? `AND ($${ministryParamIdx}::text IS NULL OR ministry ILIKE '%' || $${ministryParamIdx} || '%')`
    : "";
  return `
    WITH ab_clean AS (
      SELECT DISTINCT ON (
        ministry, business_unit_name, recipient, program, amount, payment_date
      )
        id, recipient, program, ministry, amount, display_fiscal_year,
        ts_rank_cd(
          to_tsvector('english',
            coalesce(program, '') || ' ' ||
            coalesce(recipient, '') || ' ' ||
            coalesce(ministry, '')
          ),
          to_tsquery('english', $1),
          32
        ) AS rank
      FROM ab.ab_grants
      WHERE ${amountClause}
        AND amount > 0
        AND recipient IS NOT NULL
        AND program IS NOT NULL
        AND to_tsvector('english',
              coalesce(program, '') || ' ' ||
              coalesce(recipient, '') || ' ' ||
              coalesce(ministry, '')
            ) @@ to_tsquery('english', $1)
        ${ministryClause}
      ORDER BY ministry, business_unit_name, recipient, program, amount, payment_date,
               id
    )
    SELECT * FROM ab_clean
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
}

function abContractsSearchSql(
  amountFloor: number,
  withAmountRange: boolean,
  withMinistry: boolean,
  limit: number,
): string {
  const amountClause = withAmountRange
    ? `amount BETWEEN $2 AND $3`
    : `amount >= ${amountFloor}`;
  const ministryParamIdx = withAmountRange ? 4 : 2;
  const ministryClause = withMinistry
    ? `AND ($${ministryParamIdx}::text IS NULL OR ministry ILIKE '%' || $${ministryParamIdx} || '%')`
    : "";
  return `
    SELECT
      id, recipient, ministry, amount, display_fiscal_year,
      ts_rank_cd(
        to_tsvector('english',
          coalesce(recipient, '') || ' ' || coalesce(ministry, '')
        ),
        to_tsquery('english', $1),
        32
      ) AS rank
    FROM ab.ab_contracts
    WHERE ${amountClause}
      AND amount > 0
      AND recipient IS NOT NULL
      AND to_tsvector('english',
            coalesce(recipient, '') || ' ' || coalesce(ministry, '')
          ) @@ to_tsquery('english', $1)
      ${ministryClause}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
}

/* ─────────────────────────────────────────────────────────────────────────
   Row → ComparableRecord mappers
   ───────────────────────────────────────────────────────────────────── */

function fedToRecord(row: FedRow, i: number, sim: number): ComparableRecord {
  const desc = row.description_en ?? "";
  const excerpt = desc.length > 240 ? desc.slice(0, 240) + "…" : desc;
  return {
    recordId: row.ref_number ?? `fed-${i}`,
    sourceDataset: "fed",
    recipientLegalName: row.recipient_legal_name ?? "—",
    recipientBn: row.recipient_business_number ?? null,
    recipientProvince: row.recipient_province ?? null,
    awardingDept: row.owner_org_title ?? "—",
    programCode: row.prog_name_en ?? null,
    fiscalYear: fiscalYearOf(row.agreement_start_date),
    agreementValue: Number(row.agreement_value) || 0,
    description: excerpt,
    similarity: sim,
    retrievalReason: "keyword",
  };
}

function abGrantsToRecord(row: AbGrantsRow, sim: number): ComparableRecord {
  // No real description; synthesize from program + ministry
  const desc = [row.program, row.ministry].filter(Boolean).join(" · ");
  return {
    recordId: row.id,
    sourceDataset: "ab_grants",
    recipientLegalName: row.recipient ?? "—",
    recipientBn: null,
    recipientProvince: "AB",
    awardingDept: row.ministry ?? "Government of Alberta",
    programCode: row.program ?? null,
    fiscalYear: fiscalYearFromAbLabel(row.display_fiscal_year),
    agreementValue: Number(row.amount) || 0,
    description: desc,
    similarity: sim,
    retrievalReason: "keyword",
  };
}

function abContractsToRecord(row: AbContractsRow, sim: number): ComparableRecord {
  const desc = `Provincial contract · ${row.ministry ?? ""}`.trim();
  return {
    recordId: row.id,
    sourceDataset: "ab_contracts",
    recipientLegalName: row.recipient ?? "—",
    recipientBn: null,
    recipientProvince: "AB",
    awardingDept: row.ministry ?? "Government of Alberta",
    programCode: null,
    fiscalYear: fiscalYearFromAbLabel(row.display_fiscal_year),
    agreementValue: Number(row.amount) || 0,
    description: desc,
    similarity: sim,
    retrievalReason: "keyword",
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Public APIs
   ───────────────────────────────────────────────────────────────────── */

export interface SearchResult {
  records: ComparableRecord[];
  bySource: Record<DatasetSource, number>;
  latencyMs: number;
  retrievalMode: "keyword" | "hybrid";
}

/**
 * Standalone search across federal + AB sources for /search.
 */
export async function searchCorpus(
  queryText: string,
  awardingDept?: string,
  limit: number = 25,
): Promise<SearchResult> {
  const start = Date.now();
  const empty: SearchResult = {
    records: [],
    bySource: { fed: 0, ab_grants: 0, ab_contracts: 0, general: 0 },
    latencyMs: 0,
    retrievalMode: "keyword",
  };

  const tsq = tsqueryFor(queryText, "");
  if (!tsq) return { ...empty, latencyMs: Date.now() - start };

  const dept = normalizeDept(awardingDept);
  const fedLimit = Math.ceil(limit * 0.6);
  const abGrantsLimit = Math.ceil(limit * 0.3);
  const abContractsLimit = Math.ceil(limit * 0.2);

  // Search uses longQuery (30s server-side statement_timeout, dedicated
  // long pool) instead of the 8s fast pool. Common short queries like
  // "ai" or "research" can hit tens of thousands of FTS-matching rows
  // and the candidate-rank-then-dedup pattern routinely needs 5–15s.
  // Acceptable for an interactive search page; not acceptable in any
  // request that has a tighter SLA.
  const [fedR, abGrantsR, abContractsR] = await Promise.allSettled([
    longQuery<FedRow>(
      fedSearchSql({ withAmountRange: false, withDept: !!dept, limit: fedLimit }),
      dept ? [tsq, dept] : [tsq],
      30_000,
    ),
    longQuery<AbGrantsRow>(
      abGrantsSearchSql(100_000, false, !!dept, abGrantsLimit),
      dept ? [tsq, dept] : [tsq],
      30_000,
    ),
    longQuery<AbContractsRow>(
      abContractsSearchSql(100_000, false, !!dept, abContractsLimit),
      dept ? [tsq, dept] : [tsq],
      30_000,
    ),
  ]);

  const fedRows = fedR.status === "fulfilled" ? fedR.value.rows : [];
  const abGrantsRows = abGrantsR.status === "fulfilled" ? abGrantsR.value.rows : [];
  const abContractsRows =
    abContractsR.status === "fulfilled" ? abContractsR.value.rows : [];

  if (fedR.status === "rejected") {
    console.warn("[search] fed query failed:", (fedR.reason as Error).message);
  }
  if (abGrantsR.status === "rejected") {
    console.warn("[search] ab_grants query failed:", (abGrantsR.reason as Error).message);
  }
  if (abContractsR.status === "rejected") {
    console.warn("[search] ab_contracts query failed:", (abContractsR.reason as Error).message);
  }

  const allRanks = [
    ...fedRows.map((r) => Number(r.rank) || 0),
    ...abGrantsRows.map((r) => Number(r.rank) || 0),
    ...abContractsRows.map((r) => Number(r.rank) || 0),
  ];
  const maxRank = Math.max(...allRanks, 1e-6);

  const records: ComparableRecord[] = [
    ...fedRows.map((r, i) => fedToRecord(r, i, normRank(r.rank, maxRank))),
    ...abGrantsRows.map((r) => abGrantsToRecord(r, normRank(r.rank, maxRank))),
    ...abContractsRows.map((r) => abContractsToRecord(r, normRank(r.rank, maxRank))),
  ]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return {
    records,
    bySource: {
      fed: fedRows.length,
      ab_grants: abGrantsRows.length,
      ab_contracts: abContractsRows.length,
      general: 0,
    },
    latencyMs: Date.now() - start,
    retrievalMode: "keyword",
  };
}

/**
 * Draft-evaluation retrieval: same multi-source pattern but with the
 * amount-range prefilter (anticipatedAmount × {0.4, 2.5}). Returns just
 * the merged ComparableRecord[] for backward compat with buildResult.ts.
 *
 * Falls back to mockComparables only when the keyword extractor returns
 * nothing or every source query is empty.
 */
export async function retrieveComparables(
  draftText: string,
  workingTitle: string,
  anticipatedAmount: number,
  awardingDept: string,
): Promise<ComparableRecord[]> {
  const tsq = tsqueryFor(draftText, workingTitle);
  if (!tsq) {
    console.warn(
      "[retrieve] SHIPPING_MOCK_FALLBACK — keyword extractor returned nothing",
    );
    return generateMockComparables(draftText, workingTitle);
  }

  const minAmount =
    anticipatedAmount > 0 ? Math.max(100_000, anticipatedAmount * 0.4) : 100_000;
  const maxAmount =
    anticipatedAmount > 0 ? anticipatedAmount * 2.5 : 250_000_000;
  const dept = normalizeDept(awardingDept);
  const fedLimit = 8;
  const abGrantsLimit = 4;
  const abContractsLimit = 4;

  const fedParams = dept
    ? [tsq, minAmount, maxAmount, dept]
    : [tsq, minAmount, maxAmount];
  const abParams = dept
    ? [tsq, minAmount, maxAmount, dept]
    : [tsq, minAmount, maxAmount];

  const [fedR, abGrantsR, abContractsR] = await Promise.allSettled([
    query<FedRow>(
      fedSearchSql({ withAmountRange: true, withDept: !!dept, limit: fedLimit }),
      fedParams,
    ),
    query<AbGrantsRow>(
      abGrantsSearchSql(100_000, true, !!dept, abGrantsLimit),
      abParams,
    ),
    query<AbContractsRow>(
      abContractsSearchSql(100_000, true, !!dept, abContractsLimit),
      abParams,
    ),
  ]);

  let fedRows = fedR.status === "fulfilled" ? fedR.value.rows : [];
  const abGrantsRows = abGrantsR.status === "fulfilled" ? abGrantsR.value.rows : [];
  const abContractsRows =
    abContractsR.status === "fulfilled" ? abContractsR.value.rows : [];

  // Dept-filter-thin relax for fed
  if (dept && fedRows.length < 3) {
    console.warn(
      `[retrieve] DEPT_PREFILTER_THIN: ${dept} returned ${fedRows.length} fed rows, relaxing fed`,
    );
    try {
      const r = await query<FedRow>(
        fedSearchSql({ withAmountRange: true, withDept: false, limit: fedLimit }),
        [tsq, minAmount, maxAmount],
      );
      fedRows = r.rows;
    } catch (err) {
      console.warn(
        "[retrieve] fed relax failed:",
        (err as Error).message,
      );
    }
  }

  if (fedR.status === "rejected") {
    console.warn(
      "[retrieve] SHIPPING_PARTIAL_FALLBACK — fed query failed:",
      (fedR.reason as Error).message,
    );
  }
  if (abGrantsR.status === "rejected") {
    console.warn(
      "[retrieve] SHIPPING_PARTIAL_FALLBACK — ab_grants query failed:",
      (abGrantsR.reason as Error).message,
    );
  }
  if (abContractsR.status === "rejected") {
    console.warn(
      "[retrieve] SHIPPING_PARTIAL_FALLBACK — ab_contracts query failed:",
      (abContractsR.reason as Error).message,
    );
  }

  if (fedRows.length === 0 && abGrantsRows.length === 0 && abContractsRows.length === 0) {
    console.warn(
      `[retrieve] SHIPPING_MOCK_FALLBACK — 0 rows from all three sources for tsquery '${tsq}'`,
    );
    return generateMockComparables(draftText, workingTitle);
  }

  const allRanks = [
    ...fedRows.map((r) => Number(r.rank) || 0),
    ...abGrantsRows.map((r) => Number(r.rank) || 0),
    ...abContractsRows.map((r) => Number(r.rank) || 0),
  ];
  const maxRank = Math.max(...allRanks, 1e-6);

  return [
    ...fedRows.map((r, i) => fedToRecord(r, i, normRank(r.rank, maxRank))),
    ...abGrantsRows.map((r) => abGrantsToRecord(r, normRank(r.rank, maxRank))),
    ...abContractsRows.map((r) => abContractsToRecord(r, normRank(r.rank, maxRank))),
  ].sort((a, b) => b.similarity - a.similarity);
}

function normRank(rank: string | number, max: number): number {
  return Math.max(0, Math.min(1, (Number(rank) || 0) / max));
}

/* ─────────────────────────────────────────────────────────────────────────
   Single-record loader for /record/[source]/[recordId]
   ───────────────────────────────────────────────────────────────────── */

export async function loadRecord(
  source: DatasetSource,
  recordId: string,
): Promise<ComparableRecord | null> {
  try {
    if (source === "fed") {
      const r = await query<FedRow>(
        `WITH agreement_current AS (
           SELECT DISTINCT ON (
             ref_number,
             COALESCE(recipient_business_number, recipient_legal_name, _id::text)
           )
             ref_number, recipient_legal_name, recipient_business_number,
             recipient_province, owner_org_title, prog_name_en,
             agreement_value, agreement_start_date, description_en,
             0::float AS rank
           FROM fed.grants_contributions
           WHERE ref_number = $1
           ORDER BY
             ref_number,
             COALESCE(recipient_business_number, recipient_legal_name, _id::text),
             NULLIF(amendment_number, '')::int DESC NULLS LAST,
             _id DESC
         )
         SELECT * FROM agreement_current LIMIT 1`,
        [recordId],
      );
      return r.rows[0] ? fedToRecord(r.rows[0], 0, 1) : null;
    }
    if (source === "ab_grants") {
      const r = await query<AbGrantsRow>(
        `SELECT id, recipient, program, ministry, amount, display_fiscal_year,
                0::float AS rank
           FROM ab.ab_grants
          WHERE id = $1
          LIMIT 1`,
        [recordId],
      );
      return r.rows[0] ? abGrantsToRecord(r.rows[0], 1) : null;
    }
    if (source === "ab_contracts") {
      const r = await query<AbContractsRow>(
        `SELECT id, recipient, ministry, amount, display_fiscal_year,
                0::float AS rank
           FROM ab.ab_contracts
          WHERE id = $1
          LIMIT 1`,
        [recordId],
      );
      return r.rows[0] ? abContractsToRecord(r.rows[0], 1) : null;
    }
  } catch (err) {
    console.warn("[loadRecord] failed:", (err as Error).message);
  }
  return null;
}

/**
 * Federal amendment chain — all amendments for a given ref_number, ordered
 * by amendment_number ASC. Used by /record/fed/[recordId] to render the
 * timeline. Returns empty array for non-federal sources.
 */
export interface AmendmentEvent {
  amendmentNumber: number;
  date: string | null;
  agreementValue: number;
  description: string | null;
}

export async function loadAmendmentChain(
  source: DatasetSource,
  recordId: string,
): Promise<AmendmentEvent[]> {
  if (source !== "fed") return [];
  try {
    const r = await query<{
      amendment_number: string | null;
      amendment_date: string | null;
      agreement_value: string | number | null;
      description_en: string | null;
    }>(
      `SELECT amendment_number, amendment_date, agreement_value, description_en
         FROM fed.grants_contributions
        WHERE ref_number = $1
        ORDER BY NULLIF(amendment_number, '')::int ASC NULLS FIRST, _id ASC`,
      [recordId],
    );
    return r.rows.map((row) => ({
      amendmentNumber: Number(row.amendment_number) || 0,
      date: row.amendment_date,
      agreementValue: Number(row.agreement_value) || 0,
      description: row.description_en,
    }));
  } catch (err) {
    console.warn("[loadAmendmentChain] failed:", (err as Error).message);
    return [];
  }
}
