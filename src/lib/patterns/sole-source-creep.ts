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
 * Sole-source amendment creep.
 *
 * `agreement_value` on fed.grants_contributions is CUMULATIVE
 * (KNOWN-DATA-ISSUES F-3): every amendment row restates the running total
 * of the whole agreement, it is not a delta. Verified on
 * 001-2020-2021-Q1-00006: 20.54M (amendment 0) → 36.24M → 36.24M →
 * 36.24M. Summing amendment rows onto the original therefore
 * triple-counts (that chain read as 6.29× under the old delta model; the
 * true expansion is 1.76×).
 *
 * Per agreement — keyed by the F-1 key (ref_number, COALESCE(bn,
 * legal_name, _id)) because ref_number alone collides across unrelated
 * recipients — we take:
 *   original_value = agreement_value of the amendment-0 row
 *                    (lowest amendment_number; must be is_amendment = false)
 *   final_value    = agreement_value of the highest amendment_number row
 *   growth_ratio   = final_value / original_value
 *
 * Match condition (TRACE definition): original_value ≥ $100K AND
 * growth_ratio ≥ 3.0 AND ≥ 1 amendment row.
 */

interface CreepRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  owner_org_title: string | null;
  original_value: string | number | null;
  final_value: string | number | null;
  amendment_count: string | number | null;
  first_amendment: string | Date | null;
  last_amendment: string | Date | null;
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

function asIso(d: string | Date | null): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Cumulative-value growth ratio; 0 when there is no positive original. */
export function creepRatio(originalValue: number, finalValue: number): number {
  return originalValue > 0 ? finalValue / originalValue : 0;
}

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

    // Ordered array_agg picks the first/last row of each chain without a
    // second window pass. Aggregating 1.27M rows into ~1M chains exceeds
    // the fast pool's 8s budget; long pool, 60s server-side guard.
    const r = await longQuery<CreepRow>(
      `WITH chain AS (
         SELECT ref_number,
                COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
                recipient_legal_name,
                owner_org_title,
                agreement_value,
                amendment_date,
                is_amendment,
                NULLIF(amendment_number, '')::int AS amend_n,
                _id
           FROM fed.grants_contributions
          WHERE ref_number IS NOT NULL
            AND agreement_value > 0${extra}
       ),
       agg AS (
         SELECT ref_number,
                (array_agg(recipient_legal_name ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS recipient_legal_name,
                (array_agg(owner_org_title      ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS owner_org_title,
                (array_agg(agreement_value      ORDER BY amend_n ASC NULLS FIRST, _id ASC))[1]  AS original_value,
                (array_agg(is_amendment         ORDER BY amend_n ASC NULLS FIRST, _id ASC))[1]  AS original_is_amendment,
                (array_agg(agreement_value      ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS final_value,
                COUNT(*) FILTER (WHERE is_amendment)             AS amendment_count,
                MIN(amendment_date) FILTER (WHERE is_amendment)  AS first_amendment,
                MAX(amendment_date) FILTER (WHERE is_amendment)  AS last_amendment
           FROM chain
          GROUP BY ref_number, agreement_key
         HAVING COUNT(*) FILTER (WHERE is_amendment) >= 1
       )
       SELECT ref_number, recipient_legal_name, owner_org_title,
              original_value, final_value, amendment_count,
              first_amendment, last_amendment
         FROM agg
        WHERE NOT original_is_amendment
          AND original_value >= $1
          AND final_value / original_value >= $2
        ORDER BY final_value / original_value DESC
        LIMIT $${params.length}`,
      params,
      60_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: CreepRow): PatternMatch | null {
  const original = Number(row.original_value) || 0;
  const final = Number(row.final_value) || 0;
  if (original <= 0) return null;
  const ratio = creepRatio(original, final);
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
        value: asIso(row.first_amendment),
      },
      {
        source: "fed.grants_contributions",
        rowId: row.ref_number ?? "",
        field: "last_amendment",
        value: asIso(row.last_amendment),
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
