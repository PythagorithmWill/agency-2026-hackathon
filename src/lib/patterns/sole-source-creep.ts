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
 * Sole-source amendment creep. Federal corpus uses `is_amendment` boolean:
 *   is_amendment = false → original agreement row(s) per ref_number
 *   is_amendment = true  → amendment delta rows (agreement_value can be
 *                          negative for reductions)
 *
 * For each ref_number we compute:
 *   original_value   = SUM(agreement_value) WHERE is_amendment = false
 *   amendment_total  = SUM(agreement_value) WHERE is_amendment = true
 *   final_value      = original_value + amendment_total
 *   growth_ratio     = final_value / original_value
 *
 * Match condition (TRACE definition): original_value ≥ $100K AND
 * growth_ratio ≥ 3.0 AND amendment_count ≥ 1.
 */

interface CreepRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  owner_org_title: string | null;
  original_value: string | number | null;
  amendment_total: string | number | null;
  amendment_count: string | number | null;
  first_amendment: string | null;
  last_amendment: string | null;
}

const ORIGINAL_VALUE_FLOOR = 100_000;
const GROWTH_RATIO_FLOOR = 3.0;

function severityFor(ratio: number): SignalStrength {
  if (ratio >= 10) return "flag";
  if (ratio >= 5) return "attention";
  return "observation";
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export const soleSourceCreepDetector: PatternDetector = {
  pattern: getPattern("sole-source-creep")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [ORIGINAL_VALUE_FLOOR, GROWTH_RATIO_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND ref_number = $${params.length}`;
    }
    params.push(limit);

    // Window-function scan over 1.27M rows exceeds the fast pool's 8s
    // budget on first run; use the long pool with a 30s server-side
    // statement_timeout.
    const r = await longQuery<CreepRow>(
      `WITH chain AS (
         SELECT ref_number,
                MAX(recipient_legal_name) AS recipient_legal_name,
                MAX(owner_org_title) AS owner_org_title,
                SUM(agreement_value) FILTER (WHERE is_amendment = false) AS original_value,
                SUM(agreement_value) FILTER (WHERE is_amendment = true) AS amendment_total,
                COUNT(*) FILTER (WHERE is_amendment = true) AS amendment_count,
                MIN(amendment_date) FILTER (WHERE is_amendment = true) AS first_amendment,
                MAX(amendment_date) FILTER (WHERE is_amendment = true) AS last_amendment
           FROM fed.grants_contributions
          WHERE ref_number IS NOT NULL${extra}
          GROUP BY ref_number
         HAVING COUNT(*) FILTER (WHERE is_amendment = true) >= 1
            AND SUM(agreement_value) FILTER (WHERE is_amendment = false) >= $1
       )
       SELECT *
         FROM chain
        WHERE (original_value + COALESCE(amendment_total, 0)) / NULLIF(original_value, 0) >= $2
        ORDER BY (original_value + COALESCE(amendment_total, 0)) / NULLIF(original_value, 0) DESC
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

function mapRowToMatch(row: CreepRow): PatternMatch | null {
  const original = Number(row.original_value) || 0;
  const amendments = Number(row.amendment_total) || 0;
  const final = original + amendments;
  if (original <= 0) return null;
  const ratio = final / original;
  if (ratio < GROWTH_RATIO_FLOOR) return null;

  const recipient = row.recipient_legal_name ?? "Unknown recipient";
  const dept = row.owner_org_title ?? "Unknown department";
  const amendCount = Number(row.amendment_count) || 0;

  return {
    patternId: "sole-source-creep",
    matchId: `sole-source-creep:${row.ref_number}`,
    subject: {
      type: "agreement",
      id: row.ref_number ?? "",
      canonicalName: recipient,
    },
    evidence: [
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "original_value",
        value: original,
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "amendment_count",
        value: amendCount,
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "final_value",
        value: final,
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "growth_ratio",
        value: ratio.toFixed(2),
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "department",
        value: dept,
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "first_amendment",
        value: row.first_amendment,
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "last_amendment",
        value: row.last_amendment,
      },
    ],
    calibratedSummary: `The dataset shows record ${row.ref_number} (${recipient} · ${dept}) growing from ${dollar.format(original)} initial commitment to ${dollar.format(final)} current commitment across ${amendCount} amendments — a ${ratio.toFixed(1)}× expansion.`,
    signalStrength: severityFor(ratio),
    detectedAt: new Date().toISOString(),
  };
}

/** Pure helper exported for unit tests. */
export function _mapForTest(row: CreepRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _CREEP_FLOORS_FOR_TEST = {
  ORIGINAL_VALUE_FLOOR,
  GROWTH_RATIO_FLOOR,
};
