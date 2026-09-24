import { longQuery } from "../db/pool";
import { getPattern, THRESHOLDS } from "./registry";
import { normalizeBn } from "./identity";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type Severity,
  meetsMinSignal,
} from "./types";
import { evidenceStrength, benignNoteFor, marginOver, severityToSignalStrength, MIN_GROUP } from "./strength";
import { num } from "./format";

/**
 * Duplicative funding & gaps (Challenge #8); methodology v2.
 *
 * Surfaces entities that received funding from BOTH the federal grants &
 * contributions stream and Alberta provincial grants — recipients who
 * sit at the intersection of two funder pools. This is not, on its own,
 * evidence of duplication: many recipients legitimately receive grants
 * for distinct programs from each level. The detector calibrates by
 * cumulative source-record count across both funders, which scales
 * roughly with potential overlap surface area.
 *
 * Glassbox uses the cross-dataset golden-record entity layer to do the
 * fuzzy-name match correctly (BN root + alias collapse), avoiding the
 * naive "string equality across schemas" pitfall.
 *
 * Match condition (v2):
 *   'fed' IN dataset_sources AND 'ab' IN dataset_sources
 *   federal records ≥ 5 AND alberta records ≥ 5                — floors
 *   combined records ≥ p90 within the entity's entity_type     — relative
 *   confidence ≥ 0.7
 *
 * Not windowed: golden-record source counts are lifetime tallies; a
 * rolling window would require re-joining 5M source links.
 */

interface DupRow {
  id: number;
  canonical_name: string | null;
  entity_type: string | null;
  bn_root: string | null;
  fed_records: string | number | null;
  ab_records: string | number | null;
  combined: string | number | null;
  total_records: string | number | null;
  confidence: string | number | null;
  type_p90: string | number | null;
  type_peer_count: string | number | null;
  province: string | null;
}

const FED_FLOOR = THRESHOLDS.DUP_FED_FLOOR;
const AB_FLOOR = THRESHOLDS.DUP_AB_FLOOR;
const CONFIDENCE_FLOOR = THRESHOLDS.GOLDEN_CONFIDENCE_FLOOR;

function severityFor(fedRecords: number, abRecords: number): Severity {
  if (fedRecords >= 250 && abRecords >= 250) return "critical";
  if (fedRecords >= 100 && abRecords >= 100) return "high";
  if (fedRecords >= 25 || abRecords >= 25) return "medium";
  return "low";
}

const AB_RECORDS_SQL = `(COALESCE((source_summary->>'ab.ab_grants')::int, 0)
                + COALESCE((source_summary->>'ab.ab_contracts')::int, 0)
                + COALESCE((source_summary->>'ab.ab_sole_source')::int, 0))`;
const FED_RECORDS_SQL = `COALESCE((source_summary->>'fed.grants_contributions')::int, 0)`;

export const duplicativeFundingDetector: PatternDetector = {
  pattern: getPattern("duplicative-funding")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [FED_FLOOR, AB_FLOOR, CONFIDENCE_FLOOR, THRESHOLDS.PERCENTILE];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (d.bn_root = $${params.length} OR d.canonical_name = $${params.length})`;
    }
    params.push(limit);

    const r = await longQuery<DupRow>(
      `WITH dual AS (
         SELECT id, canonical_name, entity_type, bn_root, confidence,
                ${FED_RECORDS_SQL} AS fed_records,
                ${AB_RECORDS_SQL}  AS ab_records,
                ${FED_RECORDS_SQL} + ${AB_RECORDS_SQL} AS combined,
                source_link_count AS total_records
           FROM general.entity_golden_records
          WHERE 'fed' = ANY(dataset_sources)
            AND 'ab'  = ANY(dataset_sources)
            AND ${FED_RECORDS_SQL} >= $1
            AND ${AB_RECORDS_SQL}  >= $2
            AND confidence >= $3
       ),
       type_p AS (
         SELECT COALESCE(entity_type, 'unknown') AS et,
                percentile_cont($4) WITHIN GROUP (ORDER BY combined) AS p90,
                COUNT(*) AS n
           FROM dual GROUP BY 1
       )
       SELECT d.*, tp.p90 AS type_p90, tp.n AS type_peer_count,
              (SELECT a->>'province' FROM general.entity_golden_records g,
                      jsonb_array_elements(COALESCE(g.addresses, '[]'::jsonb)) a
                WHERE g.id = d.id AND a->>'province' IS NOT NULL LIMIT 1) AS province
         FROM dual d
         JOIN type_p tp ON tp.et = COALESCE(d.entity_type, 'unknown')
        WHERE d.combined >= tp.p90${extra}
        ORDER BY d.combined DESC
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 30_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: DupRow): PatternMatch | null {
  const fedRecords = num(row.fed_records);
  const abRecords = num(row.ab_records);
  if (fedRecords < FED_FLOOR || abRecords < AB_FLOOR) return null;
  const combined = num(row.combined) || fedRecords + abRecords;
  const confidence = num(row.confidence);
  const p90 = num(row.type_p90);
  const peers = num(row.type_peer_count);

  const name = row.canonical_name ?? "Unknown entity";
  const bn = normalizeBn(row.bn_root);
  const id = bn ?? row.canonical_name ?? String(row.id);
  const flags = {
    missingBn: bn == null,
    lowConfidence: confidence < 0.85,
    smallGroup: peers > 0 && peers < MIN_GROUP,
  };
  const margin = p90 > 0 ? marginOver(combined, p90) : marginOver(Math.min(fedRecords, abRecords), FED_FLOOR);
  const severity = severityFor(fedRecords, abRecords);
  const rowId = String(row.id);

  return {
    patternId: "duplicative-funding",
    matchId: `duplicative-funding:${id}`,
    subject: { type: "recipient", id, canonicalName: name },
    evidence: [
      { source: "general.entity_golden_records", rowId, field: "fed_records", value: fedRecords },
      { source: "general.entity_golden_records", rowId, field: "ab_records", value: abRecords },
      { source: "general.entity_golden_records", rowId, field: "combined_records", value: combined },
      { source: "general.entity_golden_records", rowId, field: "entity_type", value: row.entity_type },
      { source: "general.entity_golden_records", rowId, field: "entity_type_p90", value: Math.round(p90) },
      { source: "general.entity_golden_records", rowId, field: "confidence", value: confidence },
    ],
    calibratedSummary: `The dataset shows ${name}${row.entity_type ? ` (${row.entity_type})` : ""} appears in both federal and Alberta provincial funding streams — ${fedRecords.toLocaleString("en-CA")} federal grant/contribution records and ${abRecords.toLocaleString("en-CA")} Alberta provincial records, above the 90th percentile for ${row.entity_type ?? "entities"} of its type. Glassbox surfaces the overlap; the funder verifies whether programs are distinct or duplicative.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: combined,
    evidenceStrength: evidenceStrength({ margin, flags }),
    benignNote: benignNoteFor("duplicative-funding", { name, flags, always: ["LEGITIMATE_DUAL_FUNDING"] }),
    department: null,
    province: row.province ?? null,
    fiscalYear: null,
    detectedAt: new Date().toISOString(),
  };
}

export function _mapDuplicativeFundingForTest(row: Partial<DupRow> & { id: number }): PatternMatch | null {
  return mapRowToMatch({
    canonical_name: null, entity_type: null, bn_root: null, fed_records: null, ab_records: null,
    combined: null, total_records: null, confidence: null, type_p90: null, type_peer_count: null, province: null,
    ...row,
  });
}
export const _DUPLICATIVE_FUNDING_FLOORS_FOR_TEST = {
  FED_FLOOR,
  AB_FLOOR,
  CONFIDENCE_FLOOR,
};
