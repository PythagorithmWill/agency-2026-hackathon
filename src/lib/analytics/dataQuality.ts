import { query } from "../db/pool";
import { hasAppTable, forgetAppTable, isUndefinedTable } from "../db/features";

/**
 * Data-quality scorecard — one row per KNOWN-DATA-ISSUES id
 * (govalta-upstream/KNOWN-DATA-ISSUES.md), with the current count and
 * dollars recomputed from the corpus by scripts/refresh-derived.ts into
 * app.data_quality_scorecard.
 *
 * The catalogue below is the single source of truth: the refresh script
 * runs each entry's `sql` (one row: count, dollars), and the page reads
 * the stored result via loadDataQualityScorecard(). When the table is
 * absent the page still gets the catalogue with count/dollars = null.
 *
 * `status` is from GLASSBOX's point of view:
 *   mitigated — a Glassbox query-layer guard neutralises the defect
 *   resolved  — fixed upstream in the source data (verification query kept)
 *   active    — carried through as-is; the guard text says how it is caveated
 */
export interface DqIssue {
  id: string;
  family: "F" | "C" | "A";
  title: string;
  description: string;
  count: number | null;
  dollars: number | null;
  status: "active" | "mitigated" | "resolved";
  guard: string;
}

export interface DqCatalogueEntry extends Omit<DqIssue, "count" | "dollars"> {
  /** Single-row query returning `count` and `dollars`; absent when not computable. */
  sql?: string;
  /** Why the issue cannot be computed from the data (when `sql` is absent). */
  notComputable?: string;
}

const FED_CURRENT_SUM = `(SELECT SUM(agreement_value) FROM (
    SELECT DISTINCT ON (ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)) agreement_value
      FROM fed.grants_contributions
     WHERE agreement_value > 0 AND recipient_legal_name IS NOT NULL
     ORDER BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text),
              NULLIF(amendment_number, '')::int DESC NULLS LAST, _id DESC) c)`;

export const DQ_CATALOGUE: DqCatalogueEntry[] = [
  /* ── FED ─────────────────────────────────────────────────────────── */
  {
    id: "F-1", family: "F", title: "ref_number collisions across distinct recipients",
    description: "The same ref_number covers multiple unrelated recipients, so ref_number alone cannot identify an agreement.",
    status: "mitigated",
    guard: "Every agreement key is (ref_number, COALESCE(bn, legal_name, _id)) — the F-1 key — in the CTE path, app.agreement_current and every detector.",
    sql: `WITH c AS (
            SELECT ref_number FROM fed.grants_contributions WHERE ref_number IS NOT NULL
            GROUP BY ref_number
            HAVING COUNT(DISTINCT COALESCE(recipient_business_number,'') || '|' || COALESCE(recipient_legal_name,'')) > 1)
          SELECT (SELECT COUNT(*) FROM c) AS count,
                 (SELECT SUM(g.agreement_value) FROM fed.grants_contributions g JOIN c USING (ref_number)
                   WHERE g.is_amendment = false AND g.agreement_value > 0) AS dollars`,
  },
  {
    id: "F-2", family: "F", title: "Duplicate (ref_number, amendment_number) rows",
    description: "Within one ref_number the same amendment_number appears more than once — unambiguous publisher duplicates.",
    status: "active",
    guard: "Chains are ordered by (amendment_number, _id) so the winner is deterministic; app.agreement_current.has_duplicate_rows and the detectors' duplicateRows flag discount evidence strength.",
    sql: `WITH d AS (
            SELECT ref_number, amendment_number, COUNT(*) - 1 AS excess,
                   SUM(agreement_value) - MAX(agreement_value) AS excess_dollars
              FROM fed.grants_contributions WHERE ref_number IS NOT NULL
             GROUP BY ref_number, amendment_number HAVING COUNT(*) > 1)
          SELECT COUNT(*) AS count, SUM(excess_dollars) AS dollars FROM d`,
  },
  {
    id: "F-3", family: "F", title: "agreement_value is cumulative — naive SUM over-counts",
    description: "Every amendment row restates the running total; summing raw rows over-counts by the amendment rows' values.",
    status: "mitigated",
    guard: "All totals use the current row per F-1 key (highest amendment_number): the CTE path or app.agreement_current. Dollars = naive SUM − current commitment.",
    sql: `SELECT (SELECT COUNT(*) FROM fed.grants_contributions WHERE is_amendment) AS count,
                 (SELECT SUM(agreement_value) FROM fed.grants_contributions WHERE agreement_value > 0) - ${FED_CURRENT_SUM} AS dollars`,
  },
  {
    id: "F-4", family: "F", title: "Negative agreement_value",
    description: "TBS requires value > 0; publishers use negatives as termination / reversal markers, almost always on amendment rows.",
    status: "active",
    guard: "Base filter agreement_value > 0 everywhere; app.agreement_current.has_negative_rows and the negativeValues flag discount evidence strength.",
    sql: `SELECT COUNT(*) AS count, SUM(agreement_value) AS dollars FROM fed.grants_contributions WHERE agreement_value < 0`,
  },
  {
    id: "F-5", family: "F", title: "Zero agreement_value",
    description: "Rows carrying exactly 0 violate the TBS validation rule.",
    status: "active",
    guard: "Base filter agreement_value > 0 (and ≥ 1 in overview totals).",
    sql: `SELECT COUNT(*) AS count, 0::numeric AS dollars FROM fed.grants_contributions WHERE agreement_value = 0`,
  },
  {
    id: "F-6", family: "F", title: "recipient_business_number format polyglot",
    description: "Besides 9- and 15-character BNs the column carries placeholders ('0', '-', all-zeros) and malformed strings.",
    status: "mitigated",
    guard: "identity.ts normalizeBn() maps placeholder tokens to NULL; app.agreement_current.is_placeholder_bn; detectors carry placeholderBn / missingBn flags.",
    sql: `SELECT COUNT(*) AS count,
                 SUM(agreement_value) FILTER (WHERE is_amendment = false AND agreement_value > 0) AS dollars
            FROM fed.grants_contributions
           WHERE recipient_business_number IS NOT NULL
             AND recipient_business_number !~ '^[0-9]{9}$'
             AND recipient_business_number !~ '^[0-9]{9}[A-Z]{2}[0-9]{4}$'`,
  },
  {
    id: "F-7", family: "F", title: "Missing BN where one is expected (recipient_type N / F)",
    description: "Not-for-profit and for-profit recipients should carry a BN; many rows do not.",
    status: "active",
    guard: "Ghost-capacity detector surfaces the largest cases; name-only identity is discounted in every other detector.",
    sql: `SELECT COUNT(*) AS count,
                 SUM(agreement_value) FILTER (WHERE is_amendment = false AND agreement_value > 0) AS dollars
            FROM fed.grants_contributions
           WHERE recipient_type IN ('N','F')
             AND (recipient_business_number IS NULL OR TRIM(recipient_business_number) = '' OR LENGTH(recipient_business_number) < 9)`,
  },
  {
    id: "F-8", family: "F", title: "Missing agreement_end_date",
    description: "agreement_end_date is mandatory per TBS but NULL on ~15% of rows.",
    status: "active",
    guard: "No window is anchored on end dates; rolling windows use agreement_start_date, which is populated on every row.",
    sql: `SELECT COUNT(*) AS count,
                 SUM(agreement_value) FILTER (WHERE is_amendment = false AND agreement_value > 0) AS dollars
            FROM fed.grants_contributions WHERE agreement_end_date IS NULL`,
  },
  {
    id: "F-9", family: "F", title: "agreement_end_date before agreement_start_date",
    description: "End date precedes the start date.",
    status: "active",
    guard: "End dates are displayed but never used in a calculation.",
    sql: `SELECT COUNT(*) AS count,
                 SUM(agreement_value) FILTER (WHERE is_amendment = false AND agreement_value > 0) AS dollars
            FROM fed.grants_contributions WHERE agreement_end_date < agreement_start_date`,
  },
  {
    id: "F-10", family: "F", title: "agreement_number reused as a program code",
    description: "Free-text agreement_number is reused across thousands of unrelated grants and cannot be a join key.",
    status: "mitigated",
    guard: "agreement_number is never used as a key; count = agreement_number values shared by ≥ 100 distinct recipients.",
    sql: `WITH a AS (
            SELECT agreement_number FROM fed.grants_contributions WHERE agreement_number IS NOT NULL
             GROUP BY agreement_number HAVING COUNT(DISTINCT recipient_legal_name) >= 100)
          SELECT (SELECT COUNT(*) FROM a) AS count,
                 (SELECT SUM(g.agreement_value) FROM fed.grants_contributions g JOIN a USING (agreement_number)
                   WHERE g.is_amendment = false AND g.agreement_value > 0) AS dollars`,
  },
  {
    id: "F-11", family: "F", title: "Amendments can reduce agreement value",
    description: "About 8% of amendments with a prior value decrease it; analysts assuming monotone growth mis-read them.",
    status: "mitigated",
    guard: "Current value is always the highest-amendment row regardless of direction; dollars = total reduction across decreasing amendments.",
    sql: `WITH w AS (
            SELECT agreement_value,
                   LAG(agreement_value) OVER (
                     PARTITION BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)
                     ORDER BY NULLIF(amendment_number,'')::int NULLS FIRST, _id) AS prev
              FROM fed.grants_contributions WHERE ref_number IS NOT NULL AND agreement_value > 0)
          SELECT COUNT(*) FILTER (WHERE prev IS NOT NULL AND agreement_value < prev) AS count,
                 SUM(prev - agreement_value) FILTER (WHERE prev IS NOT NULL AND agreement_value < prev) AS dollars
            FROM w`,
  },
  /* ── CRA ─────────────────────────────────────────────────────────── */
  {
    id: "C-1", family: "C", title: "T3010 arithmetic impossibilities",
    description: "Filings that fail one of ten identities printed on the T3010 form (e.g. line 5100 = 4950 + 5045 + 5050).",
    status: "active",
    guard: "Surfaced from cra.t3010_impossibilities; dollars = sum of the per-row severity ($ impact).",
    sql: `SELECT COUNT(*) AS count, SUM(severity) AS dollars FROM cra.t3010_impossibilities`,
  },
  {
    id: "C-2", family: "C", title: "T3010 plausibility flags (unit-error candidates)",
    description: "Money fields that are very likely unit errors (dollars vs thousands) rather than form violations.",
    status: "active",
    guard: "Loop and gift evidence carries the unitErrorSuspect discount when a flagged filing is involved.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM cra.t3010_plausibility_flags`,
  },
  {
    id: "C-3", family: "C", title: "Qualified-donee BN→name mismatches",
    description: "Donee BN and donee name disagree with the register (rebrands, acronyms, DAF platforms, typos, malformed or unregistered BNs).",
    status: "mitigated",
    guard: "Gift loops use only well-formed donee BNs (^\\d{9}RR\\d{4}$); dollars = gifts on rows other than MINOR_VARIANT that cannot be joined programmatically.",
    sql: `SELECT COUNT(*) AS count, SUM(total_gifts) AS dollars FROM cra.donee_name_quality WHERE mismatch_category <> 'MINOR_VARIANT'`,
  },
  {
    id: "C-4", family: "C", title: "Qualified-donee rows broken on their face",
    description: "NULL or malformed donee BN, NULL/zero/negative amount, or empty donee name.",
    status: "active",
    guard: "Gift-loop edges require a well-formed donee BN and total_gifts ≥ $5,000; dollars = gifts on rows with NULL or malformed donee BN.",
    sql: `SELECT COUNT(*) FILTER (WHERE donee_bn IS NULL OR donee_bn !~ '^[0-9]{9}RR[0-9]{4}$'
                                    OR total_gifts IS NULL OR total_gifts <= 0
                                    OR donee_name IS NULL OR TRIM(donee_name) = '') AS count,
                 SUM(total_gifts) FILTER (WHERE donee_bn IS NULL OR donee_bn !~ '^[0-9]{9}RR[0-9]{4}$') AS dollars
            FROM cra.cra_qualified_donees`,
  },
  {
    id: "C-6", family: "C", title: "cra_directors NULL rates",
    description: "at_arms_length (5%), start_date (10%) and first_name (0.1%) are missing; shared-director detection silently drops cycles.",
    status: "active",
    guard: "Director overlap is not used by any live detector; count = director rows missing at_arms_length, start_date or a name.",
    sql: `SELECT COUNT(*) FILTER (WHERE at_arms_length IS NULL OR start_date IS NULL
                                    OR last_name IS NULL OR TRIM(last_name) = ''
                                    OR first_name IS NULL OR TRIM(first_name) = '') AS count,
                 NULL::numeric AS dollars
            FROM cra.cra_directors`,
  },
  {
    id: "C-7", family: "C", title: "Historical legal names not preserved",
    description: "CRA backfills the current legal name onto historical years; only ~1.4% of BNs show any name change.",
    status: "active",
    guard: "cra_identification.legal_name is treated as current-state, never as a historical name; count = BNs with more than one recorded name.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars
            FROM (SELECT bn FROM cra.identification_name_history GROUP BY bn HAVING COUNT(*) > 1) t`,
  },
  {
    id: "C-11", family: "C", title: "Well-formed donee BNs absent from the charity register",
    description: "Qualified donees include municipalities, universities and First Nations councils that are not charities, plus revoked or pre-2020 registrations.",
    status: "mitigated",
    guard: "Loop nodes not in cra_identification keep their donor-written name; the unregisteredDonee flag discounts strength. Dollars = gifts to such BNs.",
    sql: `WITH u AS (
            SELECT qd.donee_bn, SUM(qd.total_gifts) AS gifts
              FROM cra.cra_qualified_donees qd
             WHERE LENGTH(qd.donee_bn) = 15
               AND NOT EXISTS (SELECT 1 FROM cra.cra_identification i WHERE i.bn = qd.donee_bn)
             GROUP BY qd.donee_bn)
          SELECT COUNT(*) AS count, SUM(gifts) AS dollars FROM u`,
  },
  {
    id: "C-10", family: "C", title: "cra_political_activity_funding is empty",
    description: "The table has no rows; investigation needed upstream.",
    status: "active",
    guard: "Table is not read by Glassbox; count = rows present (0 = defect persists).",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM cra.cra_political_activity_funding`,
  },
  {
    id: "C-12", family: "C", title: "Johnson cycles were non-simple (resolved upstream)",
    description: "06-johnson-cycles.js emitted 158 cycles with a repeated vertex; fixed 2026-04-19.",
    status: "resolved",
    guard: "Verification: count = cycles whose path repeats a vertex (expected 0). Glassbox recomputes its own simple cycles in app.gift_loops regardless.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars
            FROM cra.johnson_cycles j
           WHERE (SELECT COUNT(DISTINCT x) FROM unnest(j.path_bns) x) < j.hops`,
  },
  {
    id: "C-5", family: "C", title: "Four cra_identification columns are 100% NULL",
    description: "Schema should drop or document them.",
    status: "active",
    guard: "Not computable here: the upstream note does not name the columns and Glassbox reads only bn, legal_name, province, fiscal_year, designation from this table.",
    notComputable: "Column list not specified upstream.",
  },
  {
    id: "C-8", family: "C", title: "2024 T3010 form revision (v24 → v27 field migration)",
    description: "Some fields exist only pre-2024, others only from 2023 onward, producing confusing NULL patterns by year.",
    status: "active",
    guard: "Not a countable defect — a schema-era boundary. Glassbox reads no version-specific T3010 field.",
    notComputable: "Documentation issue, not a row-level defect.",
  },
  /* ── AB ──────────────────────────────────────────────────────────── */
  {
    id: "A-1", family: "A", title: "ab_grants.fiscal_year non-canonical (resolved upstream)",
    description: "Three formats coexisted before the 2026-04-19 normalisation; now identical to display_fiscal_year.",
    status: "resolved",
    guard: "Verification: count = rows where fiscal_year ≠ display_fiscal_year (expected 0). Glassbox groups by display_fiscal_year.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM ab.ab_grants WHERE fiscal_year IS DISTINCT FROM display_fiscal_year`,
  },
  {
    id: "A-2", family: "A", title: "ab_grants.lottery is boolean-as-text without a CHECK constraint",
    description: "Only 'True'/'False' observed, but nothing enforces the value set.",
    status: "active",
    guard: "Glassbox never filters on lottery; count = rows whose lottery value is outside {'True','False',NULL} (drift detector).",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM ab.ab_grants WHERE lottery IS NOT NULL AND lottery NOT IN ('True','False')`,
  },
  {
    id: "A-3", family: "A", title: "ab_sole_source.special semantics undocumented",
    description: "The publisher does not document what the flag means.",
    status: "active",
    guard: "Not computable: a documentation gap, not a data defect. The column is displayed as opaque.",
    notComputable: "Semantics unknown; no data test expresses the defect.",
  },
  {
    id: "A-4", family: "A", title: "ab_sole_source.permitted_situations letter codes not publicly keyed",
    description: "Codes a–l, z are not mapped to Alberta's numbered list by the publisher.",
    status: "active",
    guard: "Not computable: mapping is a positional inference; codes are shown verbatim.",
    notComputable: "Codebook absent upstream; no data test expresses the defect.",
  },
  {
    id: "A-5", family: "A", title: "AB aggregate tables mix by_fiscal_year and all_years rows",
    description: "ab_grants_ministries / _programs double-count unless aggregation_type is filtered.",
    status: "mitigated",
    guard: "Glassbox aggregates from ab_grants directly and never reads the rollup tables; count = all_years rows, dollars = their total_amount.",
    sql: `SELECT (SELECT COUNT(*) FROM ab.ab_grants_ministries WHERE aggregation_type = 'all_years')
               + (SELECT COUNT(*) FROM ab.ab_grants_programs   WHERE aggregation_type = 'all_years') AS count,
                 (SELECT SUM(total_amount) FROM ab.ab_grants_ministries WHERE aggregation_type = 'all_years') AS dollars`,
  },
  {
    id: "A-6", family: "A", title: "ab_grants negative amounts (reversals / corrections)",
    description: "Alberta's convention: negative rows are reversals, not errors; naive sums double-count them.",
    status: "mitigated",
    guard: "AB search and comparables filter amount > 0 (A-6 landmine in retrieval.ts).",
    sql: `SELECT COUNT(*) AS count, SUM(amount) AS dollars FROM ab.ab_grants WHERE amount < 0`,
  },
  {
    id: "A-7", family: "A", title: "AB per-period aggregate tables stale (resolved upstream)",
    description: "Rollups were rebuilt from ab_grants on 2026-04-19.",
    status: "resolved",
    guard: "Verification: count = fiscal years whose ab_grants_fiscal_years total differs from SUM(ab_grants.amount) (expected 0).",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars
            FROM (SELECT display_fiscal_year, ROUND(SUM(amount)::numeric, 2) AS total FROM ab.ab_grants GROUP BY 1) g
            JOIN ab.ab_grants_fiscal_years f USING (display_fiscal_year)
           WHERE g.total <> ROUND(f.total_amount::numeric, 2)`,
  },
  {
    id: "A-8", family: "A", title: "ab_grants.mongo_id broke idempotent loads (resolved upstream)",
    description: "Column dropped 2026-04-19.",
    status: "resolved",
    guard: "Verification: count = mongo_id columns still present on ab.ab_grants (expected 0).",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM information_schema.columns
           WHERE table_schema = 'ab' AND table_name = 'ab_grants' AND column_name = 'mongo_id'`,
  },
  {
    id: "A-9", family: "A", title: "CSV-sourced AB rows have NULL lottery / version / timestamps",
    description: "FY 2024-25 and 2025-26 rows carry NULL for five columns; lottery filtering is unusable for FY ≥ 2023-24.",
    status: "active",
    guard: "Glassbox never filters on lottery or version.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM ab.ab_grants
           WHERE display_fiscal_year IN ('2024 - 2025','2025 - 2026') AND lottery IS NULL`,
  },
  {
    id: "A-10", family: "A", title: "Publisher roll-up rows (recipient IS NULL)",
    description: "Programme-level aggregates published as single rows with no recipient — ~$25B in the two newest years.",
    status: "mitigated",
    guard: "Recipient-level AB analysis filters recipient IS NOT NULL; the omitted aggregate is surfaced separately.",
    sql: `SELECT COUNT(*) AS count, SUM(amount) AS dollars FROM ab.ab_grants WHERE recipient IS NULL`,
  },
  {
    id: "A-11", family: "A", title: "Ministry rename / comma drift (partially resolved upstream)",
    description: "Commas stripped and JOBS variants canonicalised; genuine cabinet renames remain.",
    status: "mitigated",
    guard: "Verification: count = rows with a comma in ministry or business_unit_name (expected 0); longitudinal joins use ministries_history.",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM ab.ab_grants WHERE ministry LIKE '%,%' OR business_unit_name LIKE '%,%'`,
  },
  {
    id: "A-12", family: "A", title: "ASHC ministry / business-unit swap (resolved upstream)",
    description: "Every ALBERTA SOCIAL HOUSING CORPORATION row folded into ASSISTED LIVING AND SOCIAL SERVICES.",
    status: "resolved",
    guard: "Verification: count = rows still naming ALBERTA SOCIAL HOUSING CORPORATION (expected 0).",
    sql: `SELECT COUNT(*) AS count, NULL::numeric AS dollars FROM ab.ab_grants
           WHERE ministry = 'ALBERTA SOCIAL HOUSING CORPORATION' OR business_unit_name = 'ALBERTA SOCIAL HOUSING CORPORATION'`,
  },
  {
    id: "A-13", family: "A", title: "Exact-duplicate rows and perfect reversal pairs",
    description: "Repeated identical tuples and ±offsetting pairs make COUNT(*) unreliable as a payment count.",
    status: "mitigated",
    guard: "AB comparables DISTINCT ON the full (ministry, business_unit_name, recipient, program, amount, payment_date) tuple and drop amount ≤ 0. Count = excess duplicate rows + reversal pairs; dollars = excess dollars + one-side reversal magnitude.",
    sql: `WITH d AS (
            SELECT COUNT(*) - 1 AS excess, (COUNT(*) - 1) * amount AS excess_dollars
              FROM ab.ab_grants
             GROUP BY ministry, business_unit_name, recipient, program, amount, payment_date
            HAVING COUNT(*) > 1),
          p AS (SELECT recipient, program, ministry, amount FROM ab.ab_grants WHERE amount > 0),
          n AS (SELECT recipient, program, ministry, amount FROM ab.ab_grants WHERE amount < 0),
          r AS (SELECT COUNT(*) AS pairs, SUM(p.amount) AS magnitude
                  FROM p JOIN n USING (recipient, program, ministry) WHERE p.amount = -n.amount)
          SELECT (SELECT COALESCE(SUM(excess),0) FROM d) + (SELECT pairs FROM r) AS count,
                 (SELECT COALESCE(SUM(excess_dollars),0) FROM d) + (SELECT COALESCE(magnitude,0) FROM r) AS dollars`,
  },
];

export function catalogueIssue(e: DqCatalogueEntry): DqIssue {
  return { id: e.id, family: e.family, title: e.title, description: e.description, status: e.status, guard: e.guard, count: null, dollars: null };
}

interface DqRow {
  issue_id: string;
  family: "F" | "C" | "A";
  title: string;
  description: string;
  count: string | number | null;
  dollars: string | number | null;
  status: DqIssue["status"];
  guard: string;
  computed_at: string | Date;
}

const FAMILY_ORDER = { F: 0, C: 1, A: 2 } as const;
function issueSort(a: { id: string; family: "F" | "C" | "A" }, b: { id: string; family: "F" | "C" | "A" }): number {
  const f = FAMILY_ORDER[a.family] - FAMILY_ORDER[b.family];
  if (f !== 0) return f;
  return Number(a.id.slice(2)) - Number(b.id.slice(2));
}

export async function loadDataQualityScorecard(): Promise<{ computedAt: string | null; issues: DqIssue[] }> {
  if (await hasAppTable("data_quality_scorecard")) {
    try {
      const r = await query<DqRow>(
        `SELECT issue_id, family, title, description, count, dollars, status, guard, computed_at
           FROM app.data_quality_scorecard`,
      );
      const byId = new Map(r.rows.map((row) => [row.issue_id, row]));
      let computedAt: string | null = null;
      const issues: DqIssue[] = DQ_CATALOGUE.map((e) => {
        const row = byId.get(e.id);
        if (!row) return catalogueIssue(e);
        const ts = typeof row.computed_at === "string" ? row.computed_at : row.computed_at.toISOString();
        if (!computedAt || ts > computedAt) computedAt = ts;
        return {
          id: e.id,
          family: e.family,
          title: e.title,
          description: e.description,
          status: e.status,
          guard: e.guard,
          count: row.count == null ? null : Number(row.count),
          dollars: row.dollars == null ? null : Number(row.dollars),
        };
      });
      return { computedAt, issues: issues.sort(issueSort) };
    } catch (err) {
      if (isUndefinedTable(err)) forgetAppTable("data_quality_scorecard");
      else throw err;
    }
  }
  return { computedAt: null, issues: DQ_CATALOGUE.map(catalogueIssue).sort(issueSort) };
}
