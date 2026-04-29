import { longQuery } from "../db/pool";
import { getPattern } from "./registry";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type SignalStrength,
  meetsMinSignal,
} from "./types";

/**
 * Zombie recipients. Adapted from the hackathon repo's
 * FED/scripts/advanced/05-zombie-and-ghost.js pattern.
 *
 * Surfaces entities that received substantial federal funding then
 * stopped appearing in the data — a "zombie" signal that the entity
 * may have ceased operations after public funding flowed.
 *
 * Match condition:
 *   total federal received ≥ $500K
 *   most recent agreement_start_date < (today − 36 months)
 *   no amendments dated in the post-cutoff window
 */

interface ZombieRow {
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_type: string | null;
  recipient_province: string | null;
  recipient_city: string | null;
  grant_count: string | number | null;
  total_value: string | number | null;
  // pg returns date columns as JS Date in some configurations and as
  // ISO strings in others. Accept both.
  first_grant: string | Date | null;
  last_grant: string | Date | null;
  dept_count: string | number | null;
}

const TOTAL_FLOOR = 500_000;
const SILENCE_MONTHS = 36;

function severityFor(yearsSilent: number): SignalStrength {
  if (yearsSilent >= 6) return "flag";
  if (yearsSilent >= 4) return "attention";
  return "observation";
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export const zombieRecipientsDetector: PatternDetector = {
  pattern: getPattern("zombie-recipients")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;

    // Cutoff: 36 months ago. Note that we evaluate this server-side via
    // CURRENT_DATE - INTERVAL so the result is deterministic against the
    // replica's clock (which is the demo source of truth).
    const params: unknown[] = [TOTAL_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (recipient_business_number = $${params.length} OR recipient_legal_name = $${params.length})`;
    }
    params.push(limit);

    // Aggregating across 1.27M rows + 400K distinct recipients exceeds
    // the fast pool's 8s budget; use the long pool with a 30s server-side
    // statement_timeout for this scan.
    const r = await longQuery<ZombieRow>(
      `WITH activity AS (
         SELECT recipient_legal_name,
                recipient_business_number,
                MAX(recipient_type) AS recipient_type,
                MAX(recipient_province) AS recipient_province,
                MAX(recipient_city) AS recipient_city,
                COUNT(*) AS grant_count,
                SUM(agreement_value) AS total_value,
                MIN(agreement_start_date) AS first_grant,
                MAX(agreement_start_date) AS last_grant,
                COUNT(DISTINCT owner_org) AS dept_count
           FROM fed.grants_contributions
          WHERE recipient_legal_name IS NOT NULL
            AND agreement_value > 0
            AND is_amendment = false${extra}
          GROUP BY recipient_legal_name, recipient_business_number
       )
       SELECT *
         FROM activity
        WHERE total_value >= $1
          AND last_grant < CURRENT_DATE - INTERVAL '${SILENCE_MONTHS} months'
        ORDER BY total_value DESC
        LIMIT $${params.length}`,
      params,
      30_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: ZombieRow): PatternMatch | null {
  const total = Number(row.total_value) || 0;
  if (total < TOTAL_FLOOR) return null;
  const rawLast = row.last_grant;
  if (rawLast == null) return null;
  // pg returns date columns as JS Date, but the JSON-roundtrip path turns
  // them into ISO strings. Handle both.
  const lastGrantIso =
    typeof rawLast === "string"
      ? rawLast
      : rawLast instanceof Date
        ? rawLast.toISOString()
        : String(rawLast);
  const yearsSilent =
    (Date.now() - new Date(lastGrantIso).getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  const name = row.recipient_legal_name ?? "Unknown recipient";
  const bn = row.recipient_business_number;

  return {
    patternId: "zombie-recipients",
    matchId: `zombie-recipients:${bn ?? name}`,
    subject: {
      type: "recipient",
      id: bn ?? name,
      canonicalName: name,
    },
    evidence: [
      {
        source: "fed.grants_contributions",
        rowId: bn ?? name,
        field: "total_value",
        value: total,
      },
      {
        source: "fed.grants_contributions",
        rowId: bn ?? name,
        field: "grant_count",
        value: Number(row.grant_count) || 0,
      },
      {
        source: "fed.grants_contributions",
        rowId: bn ?? name,
        field: "first_grant",
        value:
          row.first_grant == null
            ? null
            : typeof row.first_grant === "string"
              ? row.first_grant
              : row.first_grant.toISOString(),
      },
      {
        source: "fed.grants_contributions",
        rowId: bn ?? name,
        field: "last_grant",
        value: lastGrantIso,
      },
      {
        source: "fed.grants_contributions",
        rowId: bn ?? name,
        field: "dept_count",
        value: Number(row.dept_count) || 0,
      },
    ],
    calibratedSummary: `The dataset shows ${name}${bn ? ` (BN ${bn})` : ""} received ${dollar.format(total)} across ${row.grant_count} federal agreements from ${row.dept_count} departments, with the most recent agreement dated ${lastGrantIso.slice(0, 10)} — ${yearsSilent.toFixed(1)} years of subsequent silence in the corpus.`,
    signalStrength: severityFor(yearsSilent),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapZombieForTest(row: ZombieRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _ZOMBIE_FLOORS_FOR_TEST = { TOTAL_FLOOR, SILENCE_MONTHS };
