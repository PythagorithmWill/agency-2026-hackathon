import { longQuery } from "../db/pool";
import { getPattern, THRESHOLDS } from "./registry";
import { isNullLikeId } from "./identity";
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
import { dollar, num } from "./format";

/**
 * Sole-source amendment creep (Challenge #4); methodology v2.
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
 * Match condition (v2):
 *   original_value ≥ $100K AND growth_ratio ≥ 3.0 AND ≥ 1 amendment   — TRACE floors
 *   AND growth_ratio ≥ p90 of growth ratios among ALL amended agreements
 *       in the same program (prog_name_en)                             — relative
 *
 * No time window: amendment chains span years by nature; the fiscal year
 * of the last amendment is stored so consumers can window on it.
 */

interface CreepRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_province: string | null;
  owner_org_title: string | null;
  prog_name_en: string | null;
  original_value: string | number | null;
  final_value: string | number | null;
  amendment_count: string | number | null;
  first_amendment: string | Date | null;
  last_amendment: string | Date | null;
  has_negative: boolean | null;
  has_duplicate: boolean | null;
  ref_collision: boolean | null;
  prog_p90: string | number | null;
  prog_peer_count: string | number | null;
}

const ORIGINAL_VALUE_FLOOR = THRESHOLDS.CREEP_ORIGINAL_FLOOR;
const GROWTH_RATIO_FLOOR = THRESHOLDS.CREEP_RATIO_FLOOR;

function severityFor(ratio: number): Severity {
  if (ratio >= 20) return "critical";
  if (ratio >= 10) return "high";
  if (ratio >= 5) return "medium";
  return "low";
}

/** Cumulative-value growth ratio; 0 when there is no positive original. */
export function creepRatio(originalValue: number, finalValue: number): number {
  return originalValue > 0 ? finalValue / originalValue : 0;
}

export const soleSourceCreepDetector: PatternDetector = {
  pattern: getPattern("sole-source-creep")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [ORIGINAL_VALUE_FLOOR, GROWTH_RATIO_FLOOR, THRESHOLDS.PERCENTILE];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND a.ref_number = $${params.length}`;
    }
    params.push(limit);

    const r = await longQuery<CreepRow>(
      `WITH chain AS (
         SELECT ref_number,
                COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
                recipient_legal_name, recipient_business_number, recipient_province,
                owner_org_title, prog_name_en,
                agreement_value, amendment_date, is_amendment,
                NULLIF(amendment_number, '')::int AS amend_n,
                _id
           FROM fed.grants_contributions
          WHERE ref_number IS NOT NULL
       ),
       agg AS (
         SELECT ref_number, agreement_key,
                (array_agg(recipient_legal_name       ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS recipient_legal_name,
                (array_agg(recipient_business_number  ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS recipient_business_number,
                (array_agg(recipient_province         ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS recipient_province,
                (array_agg(owner_org_title            ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS owner_org_title,
                (array_agg(prog_name_en               ORDER BY amend_n DESC NULLS LAST, _id DESC))[1] AS prog_name_en,
                (array_agg(agreement_value ORDER BY amend_n ASC NULLS FIRST, _id ASC) FILTER (WHERE agreement_value > 0))[1] AS original_value,
                (array_agg(is_amendment    ORDER BY amend_n ASC NULLS FIRST, _id ASC) FILTER (WHERE agreement_value > 0))[1] AS original_is_amendment,
                (array_agg(agreement_value ORDER BY amend_n DESC NULLS LAST, _id DESC) FILTER (WHERE agreement_value > 0))[1] AS final_value,
                COUNT(*) FILTER (WHERE is_amendment)            AS amendment_count,
                MIN(amendment_date) FILTER (WHERE is_amendment) AS first_amendment,
                MAX(amendment_date) FILTER (WHERE is_amendment) AS last_amendment,
                bool_or(agreement_value < 0)                    AS has_negative,
                COUNT(*) > COUNT(DISTINCT amend_n)              AS has_duplicate
           FROM chain
          GROUP BY ref_number, agreement_key
         HAVING COUNT(*) FILTER (WHERE is_amendment) >= 1
       ),
       amended AS (
         SELECT a.*,
                final_value / original_value AS ratio,
                COUNT(*) OVER (PARTITION BY ref_number) > 1 AS ref_collision
           FROM agg a
          WHERE original_value > 0 AND NOT original_is_amendment
       ),
       prog_p AS (
         SELECT prog_name_en,
                percentile_cont($3) WITHIN GROUP (ORDER BY ratio) AS p90,
                COUNT(*) AS n
           FROM amended
          GROUP BY prog_name_en
       )
       SELECT a.ref_number, a.recipient_legal_name, a.recipient_business_number, a.recipient_province,
              a.owner_org_title, a.prog_name_en,
              a.original_value, a.final_value, a.amendment_count,
              a.first_amendment, a.last_amendment,
              a.has_negative, a.has_duplicate, a.ref_collision,
              pp.p90 AS prog_p90, pp.n AS prog_peer_count
         FROM amended a
         JOIN prog_p pp ON pp.prog_name_en IS NOT DISTINCT FROM a.prog_name_en
        WHERE a.original_value >= $1
          AND a.ratio >= $2
          AND a.ratio >= pp.p90${extra}
        ORDER BY a.ratio DESC
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 90_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: CreepRow): PatternMatch | null {
  const original = num(row.original_value);
  const final = num(row.final_value);
  if (original <= 0) return null;
  const ratio = creepRatio(original, final);
  if (ratio < GROWTH_RATIO_FLOOR) return null;

  const recipient = row.recipient_legal_name ?? "Unknown recipient";
  const dept = row.owner_org_title ?? "Unknown department";
  const amendCount = num(row.amendment_count);
  const p90 = num(row.prog_p90);
  const peers = num(row.prog_peer_count);
  const rawBn = row.recipient_business_number;
  const lastAmendIso = asIso(row.last_amendment);
  const ref = row.ref_number ?? "";

  const flags = {
    duplicateRows: Boolean(row.has_duplicate),
    negativeValues: Boolean(row.has_negative),
    refCollision: Boolean(row.ref_collision),
    placeholderBn: rawBn != null && isNullLikeId(rawBn),
    missingBn: rawBn == null,
    smallGroup: peers > 0 && peers < MIN_GROUP,
  };
  const margin = Math.min(marginOver(ratio, GROWTH_RATIO_FLOOR), p90 > 0 ? marginOver(ratio, p90) : Infinity);
  const severity = severityFor(ratio);

  return {
    patternId: "sole-source-creep",
    matchId: `sole-source-creep:${ref}`,
    subject: { type: "agreement", id: ref, canonicalName: recipient },
    evidence: [
      { source: "fed.grants_contributions", rowId: ref, field: "original_value", value: original },
      { source: "fed.grants_contributions", rowId: ref, field: "amendment_count", value: amendCount },
      { source: "fed.grants_contributions", rowId: ref, field: "final_value", value: final },
      { source: "fed.grants_contributions", rowId: ref, field: "growth_ratio", value: ratio.toFixed(2) },
      { source: "fed.grants_contributions", rowId: ref, field: "department", value: dept },
      { source: "fed.grants_contributions", rowId: ref, field: "program", value: row.prog_name_en },
      { source: "fed.grants_contributions", rowId: ref, field: "program_p90_ratio", value: Number(p90.toFixed(2)) },
      { source: "fed.grants_contributions", rowId: ref, field: "first_amendment", value: asIso(row.first_amendment) },
      { source: "fed.grants_contributions", rowId: ref, field: "last_amendment", value: lastAmendIso },
    ],
    calibratedSummary: `The dataset shows record ${ref} (${recipient} · ${dept}) growing from ${dollar.format(original)} initial commitment to ${dollar.format(final)} current commitment across ${amendCount} ${amendCount === 1 ? "amendment" : "amendments"} — a ${ratio.toFixed(1)}× expansion, above the 90th percentile (${p90.toFixed(1)}×) of amended agreements in ${row.prog_name_en ? `"${row.prog_name_en}"` : "the same program"}.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: Number(ratio.toFixed(3)),
    evidenceStrength: evidenceStrength({ margin: Number.isFinite(margin) ? margin : 0, flags }),
    benignNote: benignNoteFor("sole-source-creep", { name: recipient, flags }),
    department: row.owner_org_title ?? null,
    province: row.recipient_province ?? null,
    fiscalYear: fiscalYearOf(lastAmendIso),
    detectedAt: new Date().toISOString(),
  };
}

/** Pure helper exported for unit tests. */
export function _mapForTest(row: Partial<CreepRow>): PatternMatch | null {
  return mapRowToMatch({
    ref_number: null, recipient_legal_name: null, recipient_business_number: null, recipient_province: null,
    owner_org_title: null, prog_name_en: null, original_value: null, final_value: null, amendment_count: null,
    first_amendment: null, last_amendment: null, has_negative: null, has_duplicate: null, ref_collision: null,
    prog_p90: null, prog_peer_count: null,
    ...row,
  });
}
export const _CREEP_FLOORS_FOR_TEST = {
  ORIGINAL_VALUE_FLOOR,
  GROWTH_RATIO_FLOOR,
};
