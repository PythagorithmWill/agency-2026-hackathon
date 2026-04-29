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
 * Related parties & governance networks (Challenge #6).
 *
 * The Glassbox cross-dataset golden-record table fuses CRA charity
 * identification, federal grants & contributions, and Alberta provincial
 * funding into single canonical entities. An entity that appears across
 * multiple datasets with a high cumulative source_link_count is, by
 * definition, sitting at a governance crossroads — receiving funds or
 * filing as a charity in more than one jurisdiction.
 *
 * This detector surfaces the top entities by cross-dataset link count
 * with at least two data sources represented, calibrated by source-link
 * volume. Severity is volume-banded — the explicit board-overlap graph
 * (CRA T3010 directors × federal recipients) is on the roadmap; this
 * detector ships the cross-dataset entity layer today.
 *
 * Match condition:
 *   array_length(dataset_sources, 1) >= 2
 *   source_link_count >= 50
 *   confidence >= 0.7
 */

interface RelatedRow {
  id: number;
  canonical_name: string | null;
  entity_type: string | null;
  bn_root: string | null;
  dataset_sources: string[] | null;
  source_summary: Record<string, number> | null;
  source_link_count: string | number | null;
  confidence: string | number | null;
}

const LINK_FLOOR = 50;
const CONFIDENCE_FLOOR = 0.7;

function severityFor(linkCount: number, datasetCount: number): SignalStrength {
  // 3+ datasets and very high link count = highest concern band
  if (datasetCount >= 3 && linkCount >= 1000) return "flag";
  if (datasetCount >= 3 || linkCount >= 500) return "attention";
  return "observation";
}

export const relatedPartiesDetector: PatternDetector = {
  pattern: getPattern("related-parties")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [LINK_FLOOR, CONFIDENCE_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (bn_root = $${params.length} OR canonical_name = $${params.length})`;
    }
    params.push(limit);

    const r = await longQuery<RelatedRow>(
      `SELECT id, canonical_name, entity_type, bn_root,
              dataset_sources, source_summary,
              source_link_count, confidence
         FROM general.entity_golden_records
        WHERE array_length(dataset_sources, 1) >= 2
          AND source_link_count >= $1
          AND confidence >= $2${extra}
        ORDER BY source_link_count DESC NULLS LAST
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

function mapRowToMatch(row: RelatedRow): PatternMatch | null {
  const linkCount = Number(row.source_link_count) || 0;
  const sources = row.dataset_sources ?? [];
  if (linkCount < LINK_FLOOR || sources.length < 2) return null;

  const name = row.canonical_name ?? "Unknown entity";
  const id = row.bn_root ?? String(row.id);
  const summary = row.source_summary ?? {};
  const summaryParts = Object.entries(summary)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/^.*\./, "")}: ${Number(v).toLocaleString("en-CA")}`)
    .join(" · ");

  return {
    patternId: "related-parties",
    matchId: `related-parties:${id}:${linkCount}`,
    subject: {
      type: "recipient",
      id,
      canonicalName: name,
    },
    evidence: [
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "dataset_sources",
        value: sources.join(","),
      },
      {
        source: "general.entity_golden_records",
        rowId: String(row.id),
        field: "source_link_count",
        value: linkCount,
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
    calibratedSummary: `The dataset shows ${name}${row.entity_type ? ` (${row.entity_type})` : ""} appears across ${sources.length} datasets — ${sources.join(", ")} — with ${linkCount.toLocaleString("en-CA")} total source records. Per-dataset breakdown: ${summaryParts}.`,
    signalStrength: severityFor(linkCount, sources.length),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapRelatedPartiesForTest(row: RelatedRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _RELATED_PARTIES_FLOORS_FOR_TEST = { LINK_FLOOR, CONFIDENCE_FLOOR };
