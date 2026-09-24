import { longQuery } from "../db/pool";
import { getPattern, THRESHOLDS } from "./registry";
import { normalizeBn, isNullLikeId } from "./identity";
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
import { dollar, num, CORPUS_AS_OF_SQL } from "./format";

/**
 * Zombie recipients (Challenge #1). Adapted from the hackathon repo's
 * FED/scripts/advanced/05-zombie-and-ghost.js pattern; methodology v2.
 *
 * Surfaces entities that received substantial federal funding then
 * stopped appearing in the data — a "zombie" signal that the entity
 * may have ceased operations after public funding flowed.
 *
 * Match condition (v2 — relative threshold + rolling window):
 *   recipient total (original commitments, is_amendment = false)
 *     ≥ p90 of recipient totals within the recipient's PRIMARY department
 *     (the department that funded it most)                      — relative
 *   AND total ≥ $500K                                          — absolute floor (secondary guard)
 *   AND last agreement_start_date < as-of − 36 months
 *       where as-of = MAX(agreement_start_date) ≤ CURRENT_DATE   — rolling window
 *
 * signal = years of silence measured from the corpus as-of date.
 */

interface ZombieRow {
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_type: string | null;
  recipient_province: string | null;
  recipient_city: string | null;
  grant_count: string | number | null;
  total_value: string | number | null;
  first_grant: string | Date | null;
  last_grant: string | Date | null;
  dept_count: string | number | null;
  primary_department: string | null;
  primary_dept_total: string | number | null;
  dept_p90: string | number | null;
  dept_peer_count: string | number | null;
  corpus_as_of: string | Date | null;
}

const TOTAL_FLOOR = THRESHOLDS.ZOMBIE_TOTAL_FLOOR;
const SILENCE_MONTHS = THRESHOLDS.ROLLING_WINDOW_MONTHS;
const SILENCE_YEARS = SILENCE_MONTHS / 12;

function severityFor(yearsSilent: number): Severity {
  if (yearsSilent >= 8) return "critical";
  if (yearsSilent >= 6) return "high";
  if (yearsSilent >= 4) return "medium";
  return "low";
}

export const zombieRecipientsDetector: PatternDetector = {
  pattern: getPattern("zombie-recipients")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [TOTAL_FLOOR, THRESHOLDS.PERCENTILE, SILENCE_MONTHS];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (recipient_business_number = $${params.length} OR recipient_legal_name = $${params.length})`;
    }
    params.push(limit);

    const r = await longQuery<ZombieRow>(
      `WITH asof AS (SELECT ${CORPUS_AS_OF_SQL} AS d),
       base AS (
         SELECT recipient_legal_name || '|' || COALESCE(recipient_business_number, '') AS rkey,
                recipient_legal_name, recipient_business_number, owner_org_title,
                recipient_type, recipient_province, recipient_city, owner_org,
                agreement_value, agreement_start_date
           FROM fed.grants_contributions
          WHERE recipient_legal_name IS NOT NULL
            AND agreement_value > 0
            AND is_amendment = false
       ),
       rd AS (
         SELECT rkey, owner_org_title, SUM(agreement_value) AS dept_total
           FROM base
          WHERE owner_org_title IS NOT NULL
          GROUP BY rkey, owner_org_title
       ),
       dept_p AS (
         SELECT owner_org_title,
                percentile_cont($2) WITHIN GROUP (ORDER BY dept_total) AS p90,
                COUNT(*) AS n
           FROM rd
          GROUP BY owner_org_title
       ),
       primary_dept AS (
         SELECT DISTINCT ON (rkey) rkey, owner_org_title AS primary_department, dept_total AS primary_dept_total
           FROM rd
          ORDER BY rkey, dept_total DESC, owner_org_title
       ),
       activity AS (
         SELECT rkey,
                MAX(recipient_legal_name) AS recipient_legal_name,
                MAX(recipient_business_number) AS recipient_business_number,
                MAX(recipient_type) AS recipient_type,
                MAX(recipient_province) AS recipient_province,
                MAX(recipient_city) AS recipient_city,
                COUNT(*) AS grant_count,
                SUM(agreement_value) AS total_value,
                MIN(agreement_start_date) AS first_grant,
                MAX(agreement_start_date) AS last_grant,
                COUNT(DISTINCT owner_org) AS dept_count
           FROM base
          WHERE true${extra}
          GROUP BY rkey
         HAVING SUM(agreement_value) >= $1
       )
       SELECT a.recipient_legal_name, a.recipient_business_number, a.recipient_type,
              a.recipient_province, a.recipient_city, a.grant_count, a.total_value,
              a.first_grant, a.last_grant, a.dept_count,
              pd.primary_department, pd.primary_dept_total,
              dp.p90 AS dept_p90, dp.n AS dept_peer_count,
              asof.d AS corpus_as_of
         FROM activity a
         JOIN primary_dept pd USING (rkey)
         JOIN dept_p dp ON dp.owner_org_title = pd.primary_department
         CROSS JOIN asof
        WHERE pd.primary_dept_total >= dp.p90
          AND a.last_grant < asof.d - ($3::int * INTERVAL '1 month')
        ORDER BY a.total_value DESC
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

function mapRowToMatch(row: ZombieRow): PatternMatch | null {
  const total = num(row.total_value);
  if (total < TOTAL_FLOOR) return null;
  const lastGrantIso = asIso(row.last_grant);
  if (!lastGrantIso) return null;
  // Rolling anchor: the corpus as-of date (falls back to now only when
  // the row was produced without it, e.g. in unit tests).
  const asOfIso = asIso(row.corpus_as_of) ?? new Date().toISOString();
  const yearsSilent =
    (new Date(asOfIso).getTime() - new Date(lastGrantIso).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);
  if (yearsSilent < SILENCE_YEARS) return null;

  const name = row.recipient_legal_name ?? "Unknown recipient";
  const rawBn = row.recipient_business_number;
  const bn = normalizeBn(rawBn);
  const grantCount = num(row.grant_count);
  const deptCount = num(row.dept_count);
  const p90 = num(row.dept_p90);
  const primaryTotal = num(row.primary_dept_total);
  const peers = num(row.dept_peer_count);

  const flags = {
    placeholderBn: rawBn != null && isNullLikeId(rawBn),
    missingBn: rawBn == null,
    nameOnlyIdentity: bn == null,
    smallGroup: peers > 0 && peers < MIN_GROUP,
  };
  // Two thresholds → the weaker margin governs.
  const margin = Math.min(
    p90 > 0 ? marginOver(primaryTotal, p90) : marginOver(total, TOTAL_FLOOR),
    marginOver(yearsSilent, SILENCE_YEARS),
  );
  const severity = severityFor(yearsSilent);
  // matchId must be unique per aggregation group (legal name × raw BN):
  // several placeholder BN spellings ("0", "-", NULL) normalise to the
  // same subject id, so the raw BN and the name both go into the key.
  const rowId = bn ?? name;

  return {
    patternId: "zombie-recipients",
    matchId: `zombie-recipients:${bn ?? name}:${rawBn ?? "-"}:${name}:${lastGrantIso.slice(0, 10)}`,
    subject: { type: "recipient", id: bn ?? name, canonicalName: name },
    evidence: [
      { source: "fed.grants_contributions", rowId, field: "total_value", value: total },
      { source: "fed.grants_contributions", rowId, field: "grant_count", value: grantCount },
      { source: "fed.grants_contributions", rowId, field: "first_grant", value: asIso(row.first_grant) },
      { source: "fed.grants_contributions", rowId, field: "last_grant", value: lastGrantIso },
      { source: "fed.grants_contributions", rowId, field: "dept_count", value: deptCount },
      { source: "fed.grants_contributions", rowId, field: "primary_department", value: row.primary_department },
      { source: "fed.grants_contributions", rowId, field: "primary_dept_total", value: primaryTotal },
      { source: "fed.grants_contributions", rowId, field: "dept_p90_threshold", value: Math.round(p90) },
      { source: "fed.grants_contributions", rowId, field: "corpus_as_of", value: asOfIso.slice(0, 10) },
      { source: "fed.grants_contributions", rowId, field: "years_silent", value: Number(yearsSilent.toFixed(2)) },
    ],
    calibratedSummary: `The dataset shows ${name}${bn ? ` (BN ${bn})` : ""} received ${dollar.format(total)} across ${grantCount} federal agreements from ${deptCount} ${deptCount === 1 ? "department" : "departments"} — above the 90th percentile of recipients funded by ${row.primary_department ?? "its primary department"} — with the most recent agreement dated ${lastGrantIso.slice(0, 10)}: ${yearsSilent.toFixed(1)} years of subsequent silence in the corpus as of ${asOfIso.slice(0, 10)}.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: Number(yearsSilent.toFixed(3)),
    evidenceStrength: evidenceStrength({ margin, flags }),
    benignNote: benignNoteFor("zombie-recipients", {
      name,
      flags,
      preferred: grantCount === 1 ? ["ONE_OFF_CAPITAL"] : [],
    }),
    department: row.primary_department ?? null,
    province: row.recipient_province ?? null,
    fiscalYear: fiscalYearOf(lastGrantIso),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapZombieForTest(row: Partial<ZombieRow> & Pick<ZombieRow, "recipient_legal_name">): PatternMatch | null {
  return mapRowToMatch({
    recipient_business_number: null,
    recipient_type: null,
    recipient_province: null,
    recipient_city: null,
    grant_count: null,
    total_value: null,
    first_grant: null,
    last_grant: null,
    dept_count: null,
    primary_department: null,
    primary_dept_total: null,
    dept_p90: null,
    dept_peer_count: null,
    corpus_as_of: null,
    ...row,
  });
}
export const _ZOMBIE_FLOORS_FOR_TEST = { TOTAL_FLOOR, SILENCE_MONTHS };
