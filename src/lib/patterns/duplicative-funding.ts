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
 * Duplicative funding & gaps (Challenge #8).
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
 * Match condition:
 *   'fed' IN dataset_sources AND 'ab' IN dataset_sources
 *   federal records >= 5 AND alberta records >= 5
 *   confidence >= 0.7
 */

interface DupRow {
  id: number;
  canonical_name: string | null;
  entity_type: string | null;
  bn_root: string | null;
  fed_records: string | number | null;
  ab_records: string | number | null;
  total_records: string | number | null;
  confidence: string | number | null;
}

const FED_FLOOR = 5;
const AB_FLOOR = 5;
const CONFIDENCE_FLOOR = 0.7;

function severityFor(fedRecords: number, abRecords: number): SignalStrength {
  // Both pools heavily engaged = highest concern band
  if (fedRecords >= 100 && abRecords >= 100) return "flag";
  if (fedRecords >= 25 || abRecords >= 25) return "attention";
  return "observation";
}

export const duplicativeFundingDetector: PatternDetector = {
  pattern: getPattern("duplicative-funding")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [FED_FLOOR, AB_FLOOR, CONFIDENCE_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (bn_root = $${params.length} OR canonical_name = $${params.length})`;
    }
    params.push(limit);

    // Pull fed + ab record counts straight from source_summary jsonb.
    // Treats fed.grants_contributions and ab.ab_grants as the two
    // primary streams; ab.ab_contracts and ab.ab_sole_source roll into
    // the AB total alongside grants.
    const r = await longQuery<DupRow>(
      `SELECT id, canonical_name, entity_type, bn_root, confidence,
              COALESCE((source_summary->>'fed.grants_contributions')::int, 0) AS fed_records,
              COALESCE((source_summary->>'ab.ab_grants')::int, 0)
                + COALESCE((source_summary->>'ab.ab_contracts')::int, 0)
                + COALESCE((source_summary->>'ab.ab_sole_source')::int, 0)
                AS ab_records,
              source_link_count AS total_records
         FROM general.entity_golden_records
        WHERE 'fed' = ANY(dataset_sources)
          AND 'ab' = ANY(dataset_sources)
          AND COALESCE((source_summary->>'fed.grants_contributions')::int, 0) >= $1
          AND (
              COALESCE((source_summary->>'ab.ab_grants')::int, 0)
            + COALESCE((source_summary->>'ab.ab_contracts')::int, 0)
            + COALESCE((source_summary->>'ab.ab_sole_source')::int, 0)
          ) >= $2
          AND confidence >= $3${extra}
        ORDER BY (
              COALESCE((source_summary->>'fed.grants_contributions')::int, 0)
            + COALESCE((source_summary->>'ab.ab_grants')::int, 0)
            + COALESCE((source_summary->>'ab.ab_contracts')::int, 0)
            + COALESCE((source_summary->>'ab.ab_sole_source')::int, 0)
          ) DESC
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

function mapRowToMatch(row: DupRow): PatternMatch | null {
  const fedRecords = Number(row.fed_records) || 0;
  const abRecords = Number(row.ab_records) || 0;
  if (fedRecords < FED_FLOOR || abRecords < AB_FLOOR) return null;

  const name = row.canonical_name ?? "Unknown entity";
  const id = row.bn_root ?? String(row.id);

  return {
    patternId: "duplicative-funding",
    matchId: `duplicative-funding:${id}`,
    subject: {
      type: "recipient",
      id,
      canonicalName: name,
    },
    evidence: [
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "fed_records",
        value: fedRecords,
      },
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "ab_records",
        value: abRecords,
      },
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "entity_type",
        value: row.entity_type,
      },
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "confidence",
        value: Number(row.confidence) || 0,
      },
    ],
    calibratedSummary: `The dataset shows ${name}${row.entity_type ? ` (${row.entity_type})` : ""} appears in both federal and Alberta provincial funding streams — ${fedRecords.toLocaleString("en-CA")} federal grant/contribution records and ${abRecords.toLocaleString("en-CA")} Alberta provincial records. Glassbox surfaces the overlap; the funder verifies whether programs are distinct or duplicative.`,
    signalStrength: severityFor(fedRecords, abRecords),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapDuplicativeFundingForTest(row: DupRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _DUPLICATIVE_FUNDING_FLOORS_FOR_TEST = {
  FED_FLOOR,
  AB_FLOOR,
  CONFIDENCE_FLOOR,
};
