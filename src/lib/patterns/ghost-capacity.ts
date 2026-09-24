import { longQuery } from "../db/pool";
import { getPattern, THRESHOLDS } from "./registry";
import { nullLikeBnSql } from "./identity";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type Severity,
  meetsMinSignal,
  asIso,
  fiscalYearOf,
} from "./types";
import { evidenceStrength, benignNoteFor, marginOver, severityToSignalStrength, MIN_GROUP } from "./strength";
import { compactDollar, num } from "./format";

/**
 * Ghost capacity (Challenge #2). Adapted from the hackathon repo's
 * FED/scripts/advanced/05-zombie-and-ghost.js section 3 ("Ghost capacity:
 * no BN, high funding"); methodology v2.
 *
 * Federal-side detection: entities receiving substantial federal funding
 * with no registered business identity (no BN). The TRACE-original
 * ghost-capacity uses CRA t3010 (zero employees, zero addresses, etc.);
 * the federal proxy used here surfaces the same red flag — recipients
 * the federal government cannot independently identify.
 *
 * Match condition (v2):
 *   recipient_business_number IS NULL, empty, or a publisher placeholder
 *     ("0", "000000000", "-", "n/a", "none", … — see identity.ts)
 *   is_amendment = false (original-agreement rows only)
 *   total within the recipient's PRIMARY department ≥ p90 of ALL recipient
 *     totals in that department (identified and unidentified alike)  — relative
 *   AND total ≥ $500K                                                — absolute floor
 *
 * Excluded: the publisher's own aggregate rows filed under the literal
 * recipient name "batch report | rapport en lots".
 */

/** Lower-cased prefixes of recipient_legal_name that are reporting artefacts, not entities. */
const EXCLUDED_NAME_PREFIXES = ["batch report"];

interface GhostRow {
  recipient_legal_name: string | null;
  recipient_type: string | null;
  recipient_province: string | null;
  recipient_city: string | null;
  grant_count: string | number | null;
  total_value: string | number | null;
  dept_count: string | number | null;
  first_grant: string | Date | null;
  last_grant: string | Date | null;
  primary_department: string | null;
  primary_dept_total: string | number | null;
  dept_p90: string | number | null;
  dept_peer_count: string | number | null;
}

const TOTAL_FLOOR = THRESHOLDS.GHOST_TOTAL_FLOOR;

function severityFor(total: number, deptCount: number): Severity {
  if (total >= 50_000_000 && deptCount >= 3) return "critical";
  if (total >= 10_000_000 && deptCount >= 3) return "high";
  if (total >= 2_000_000 || deptCount >= 3) return "medium";
  return "low";
}

export const ghostCapacityDetector: PatternDetector = {
  pattern: getPattern("ghost-capacity")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [TOTAL_FLOOR, THRESHOLDS.PERCENTILE];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND recipient_legal_name = $${params.length}`;
    }
    for (const prefix of EXCLUDED_NAME_PREFIXES) {
      params.push(`${prefix}%`);
      extra += ` AND lower(recipient_legal_name) NOT LIKE $${params.length}`;
    }
    params.push(limit);

    const r = await longQuery<GhostRow>(
      `WITH base AS (
         SELECT recipient_legal_name, recipient_business_number, owner_org_title, owner_org,
                recipient_type, recipient_province, recipient_city,
                agreement_value, agreement_start_date,
                ${nullLikeBnSql("recipient_business_number")} AS bn_missing
           FROM fed.grants_contributions
          WHERE is_amendment = false
            AND recipient_legal_name IS NOT NULL
            AND agreement_value > 0
       ),
       -- Peer distribution: every recipient (identified or not) × department.
       rd AS (
         SELECT recipient_legal_name || '|' || COALESCE(recipient_business_number, '') AS rkey,
                owner_org_title, SUM(agreement_value) AS dept_total
           FROM base
          WHERE owner_org_title IS NOT NULL
          GROUP BY 1, 2
       ),
       dept_p AS (
         SELECT owner_org_title,
                percentile_cont($2) WITHIN GROUP (ORDER BY dept_total) AS p90,
                COUNT(*) AS n
           FROM rd GROUP BY owner_org_title
       ),
       ghost_rd AS (
         SELECT recipient_legal_name, owner_org_title, SUM(agreement_value) AS dept_total
           FROM base
          WHERE bn_missing AND owner_org_title IS NOT NULL
          GROUP BY 1, 2
       ),
       ghost_primary AS (
         SELECT DISTINCT ON (recipient_legal_name)
                recipient_legal_name, owner_org_title AS primary_department, dept_total AS primary_dept_total
           FROM ghost_rd
          ORDER BY recipient_legal_name, dept_total DESC, owner_org_title
       ),
       ghost AS (
         SELECT recipient_legal_name,
                MAX(recipient_type) AS recipient_type,
                MAX(recipient_province) AS recipient_province,
                MAX(recipient_city) AS recipient_city,
                COUNT(*) AS grant_count,
                SUM(agreement_value) AS total_value,
                COUNT(DISTINCT owner_org) AS dept_count,
                MIN(agreement_start_date) AS first_grant,
                MAX(agreement_start_date) AS last_grant
           FROM base
          WHERE bn_missing${extra}
          GROUP BY recipient_legal_name
         HAVING SUM(agreement_value) >= $1
       )
       SELECT g.*, gp.primary_department, gp.primary_dept_total,
              dp.p90 AS dept_p90, dp.n AS dept_peer_count
         FROM ghost g
         JOIN ghost_primary gp USING (recipient_legal_name)
         JOIN dept_p dp ON dp.owner_org_title = gp.primary_department
        WHERE gp.primary_dept_total >= dp.p90
        ORDER BY g.total_value DESC
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 60_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: GhostRow): PatternMatch | null {
  const total = num(row.total_value);
  if (total < TOTAL_FLOOR) return null;
  const deptCount = num(row.dept_count);
  const grantCount = num(row.grant_count);
  const name = row.recipient_legal_name ?? "Unknown recipient";
  const firstGrantIso = asIso(row.first_grant);
  const lastGrantIso = asIso(row.last_grant);
  const province = row.recipient_province ?? null;
  const city = row.recipient_city ?? null;
  const p90 = num(row.dept_p90);
  const primaryTotal = num(row.primary_dept_total);
  const peers = num(row.dept_peer_count);

  // The missing BN IS the signal here, so it is not discounted; the
  // name-only grouping (distinct entities sharing a name) is.
  const flags = { nameOnlyIdentity: true, smallGroup: peers > 0 && peers < MIN_GROUP };
  const margin = p90 > 0 ? marginOver(primaryTotal, p90) : marginOver(total, TOTAL_FLOOR);
  const severity = severityFor(total, deptCount);
  const rowId = name;

  return {
    patternId: "ghost-capacity",
    matchId: `ghost-capacity:${name}`,
    subject: { type: "recipient", id: name, canonicalName: name },
    evidence: [
      { source: "fed.grants_contributions", rowId, field: "total_value", value: total },
      { source: "fed.grants_contributions", rowId, field: "grant_count", value: grantCount },
      { source: "fed.grants_contributions", rowId, field: "dept_count", value: deptCount },
      { source: "fed.grants_contributions", rowId, field: "recipient_business_number", value: null },
      { source: "fed.grants_contributions", rowId, field: "first_grant", value: firstGrantIso },
      { source: "fed.grants_contributions", rowId, field: "last_grant", value: lastGrantIso },
      { source: "fed.grants_contributions", rowId, field: "recipient_location", value: [city, province].filter(Boolean).join(", ") || null },
      { source: "fed.grants_contributions", rowId, field: "primary_department", value: row.primary_department },
      { source: "fed.grants_contributions", rowId, field: "primary_dept_total", value: primaryTotal },
      { source: "fed.grants_contributions", rowId, field: "dept_p90_threshold", value: Math.round(p90) },
    ],
    calibratedSummary: `The dataset shows ${name}${city || province ? ` (${[city, province].filter(Boolean).join(", ")})` : ""} received ${compactDollar(total)} across ${grantCount} federal agreements from ${deptCount} ${deptCount === 1 ? "department" : "departments"} — above the 90th percentile of recipients funded by ${row.primary_department ?? "its primary department"} — with no recipient business number recorded; pattern consistent with ghost capacity (entity not independently identifiable in the federal corpus).`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: total,
    evidenceStrength: evidenceStrength({ margin, flags }),
    benignNote: benignNoteFor("ghost-capacity", { name, flags }),
    department: row.primary_department ?? null,
    province,
    fiscalYear: fiscalYearOf(lastGrantIso),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapGhostForTest(row: Partial<GhostRow> & Pick<GhostRow, "recipient_legal_name">): PatternMatch | null {
  return mapRowToMatch({
    recipient_type: null,
    recipient_province: null,
    recipient_city: null,
    grant_count: null,
    total_value: null,
    dept_count: null,
    first_grant: null,
    last_grant: null,
    primary_department: null,
    primary_dept_total: null,
    dept_p90: null,
    dept_peer_count: null,
    ...row,
  });
}
export const _GHOST_FLOORS_FOR_TEST = { TOTAL_FLOOR };
