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
 * Ghost capacity. Adapted from the hackathon repo's
 * FED/scripts/advanced/05-zombie-and-ghost.js section 3 ("Ghost capacity:
 * no BN, high funding").
 *
 * Federal-side detection: entities receiving substantial federal funding
 * with no registered business identity (no BN). The TRACE-original
 * ghost-capacity uses CRA t3010 (zero employees, zero addresses, etc.);
 * the federal proxy used here surfaces the same red flag — recipients
 * the federal government cannot independently identify.
 *
 * Match condition:
 *   recipient_business_number IS NULL or empty
 *   total federal received ≥ $500K
 *   is_amendment = false (only original-agreement rows)
 *   ≥ 1 distinct funding department
 */

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
}

const TOTAL_FLOOR = 500_000;

function severityFor(total: number, deptCount: number): SignalStrength {
  // High aggregate + many distinct departments = highest concern
  if (total >= 10_000_000 && deptCount >= 3) return "flag";
  if (total >= 2_000_000 || deptCount >= 3) return "attention";
  return "observation";
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return dollar.format(v);
};

function asIso(d: string | Date | null): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

export const ghostCapacityDetector: PatternDetector = {
  pattern: getPattern("ghost-capacity")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [TOTAL_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND recipient_legal_name = $${params.length}`;
    }
    params.push(limit);

    const r = await longQuery<GhostRow>(
      `SELECT recipient_legal_name,
              MAX(recipient_type) AS recipient_type,
              MAX(recipient_province) AS recipient_province,
              MAX(recipient_city) AS recipient_city,
              COUNT(*) AS grant_count,
              SUM(agreement_value) AS total_value,
              COUNT(DISTINCT owner_org) AS dept_count,
              MIN(agreement_start_date) AS first_grant,
              MAX(agreement_start_date) AS last_grant
         FROM fed.grants_contributions
        WHERE is_amendment = false
          AND (recipient_business_number IS NULL OR recipient_business_number = '')
          AND recipient_legal_name IS NOT NULL
          AND agreement_value > 0${extra}
        GROUP BY recipient_legal_name
       HAVING SUM(agreement_value) >= $1
        ORDER BY SUM(agreement_value) DESC
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

function mapRowToMatch(row: GhostRow): PatternMatch | null {
  const total = Number(row.total_value) || 0;
  if (total < TOTAL_FLOOR) return null;
  const deptCount = Number(row.dept_count) || 0;
  const grantCount = Number(row.grant_count) || 0;
  const name = row.recipient_legal_name ?? "Unknown recipient";
  const firstGrantIso = asIso(row.first_grant);
  const lastGrantIso = asIso(row.last_grant);
  const province = row.recipient_province ?? null;
  const city = row.recipient_city ?? null;

  return {
    patternId: "ghost-capacity",
    matchId: `ghost-capacity:${name}`,
    subject: {
      type: "recipient",
      id: name,
      canonicalName: name,
    },
    evidence: [
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "total_value",
        value: total,
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "grant_count",
        value: grantCount,
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "dept_count",
        value: deptCount,
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "recipient_business_number",
        value: null, // explicitly null is the signal
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "first_grant",
        value: firstGrantIso,
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "last_grant",
        value: lastGrantIso,
      },
      {
        source: "fed.grants_contributions",
        rowId: name,
        field: "recipient_location",
        value: [city, province].filter(Boolean).join(", ") || null,
      },
    ],
    calibratedSummary: `The dataset shows ${name}${city || province ? ` (${[city, province].filter(Boolean).join(", ")})` : ""} received ${compactDollar(total)} across ${grantCount} federal agreements from ${deptCount} ${deptCount === 1 ? "department" : "departments"}, with no recipient business number recorded — pattern consistent with ghost capacity (entity not independently identifiable in the federal corpus).`,
    signalStrength: severityFor(total, deptCount),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapGhostForTest(row: GhostRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _GHOST_FLOORS_FOR_TEST = { TOTAL_FLOOR };
