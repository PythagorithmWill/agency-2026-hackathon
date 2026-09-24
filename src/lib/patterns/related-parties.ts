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
import { evidenceStrength, benignNoteFor, marginOver, severityToSignalStrength } from "./strength";
import { num } from "./format";

/**
 * Related parties & governance networks (Challenge #6); methodology v2.
 *
 * Edge source — verified on the corpus 2026-09-24:
 *   general.entity_merge_candidates (1.64M rows) is the upstream Splink /
 *   LLM adjudication queue. `llm_verdict` ∈ {DIFFERENT 1,510,665 · SAME
 *   67,601 · RELATED 64,756 · UNCERTAIN 38}; `candidate_method` ∈
 *   {trigram, smart_match, norm_name, splink_match, trade_name, dba_oa}.
 *   A RELATED verdict means the LLM judged two candidate records to be
 *   distinct legal entities that are nevertheless related (chapters of one
 *   national body, diocese vs synod, foundation vs operating charity, …),
 *   with `llm_confidence` and free-text `llm_reasoning`. entity_id_a/b are
 *   general.entities ids; 56,005 RELATED rows join to
 *   general.entity_golden_records on BOTH sides (31,743 distinct
 *   entities as side a; 62,234 distinct entities overall; max degree 290,
 *   p90 degree 4). The same verdicts are mirrored per golden record in
 *   `entity_golden_records.related_entities` jsonb (119,592 entries) — we
 *   read the candidates table because it carries the confidence score.
 *   general.splink_predictions holds pairwise match probabilities (no
 *   verdict column); general.entity_resolution_log is the per-source
 *   resolution audit trail (no RELATED concept). Neither is used here.
 *
 * Match condition (v2):
 *   ≥ 2 distinct RELATED counterparties that are themselves golden records
 *     (a single pair is a relationship; two or more is a network — 55,686
 *     entities have ≥ 1, 17,501 have ≥ 2 on the 2026-09 corpus)
 *   golden-record confidence ≥ 0.7
 * signal = number of distinct RELATED counterparties. Severity also
 * weights cross-dataset presence (≥ 2 datasets) and source-record volume.
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
  related_count: string | number | null;
  avg_related_confidence: string | number | null;
  top_related:
    | Array<{ id: number; name: string | null; confidence: number | null; reasoning: string | null; method: string | null }>
    | null;
  province: string | null;
}

const CONFIDENCE_FLOOR = THRESHOLDS.GOLDEN_CONFIDENCE_FLOOR;
/** Minimum distinct RELATED counterparties; also the strength reference. */
const RELATED_FLOOR = THRESHOLDS.RELATED_FLOOR;
const RELATED_REFERENCE = RELATED_FLOOR;

function severityFor(relatedCount: number, datasetCount: number, linkCount: number): Severity {
  if (relatedCount >= 20) return "critical";
  if (relatedCount >= 8) return "high";
  if (relatedCount >= 3) return "medium";
  // A single related counterparty is elevated when the entity spans
  // datasets with real volume — that is the governance-crossroads case.
  if (datasetCount >= 2 && linkCount >= 50) return "medium";
  return "low";
}

export const relatedPartiesDetector: PatternDetector = {
  pattern: getPattern("related-parties")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [CONFIDENCE_FLOOR, RELATED_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (g.bn_root = $${params.length} OR g.canonical_name = $${params.length})`;
    }
    params.push(limit);

    const r = await longQuery<RelatedRow>(
      `WITH rel AS (
         SELECT entity_id_a AS a, entity_id_b AS b, llm_confidence, llm_reasoning, candidate_method
           FROM general.entity_merge_candidates
          WHERE llm_verdict = 'RELATED'
       ),
       edges AS (
         SELECT a AS id, b AS other, llm_confidence, llm_reasoning, candidate_method FROM rel
         UNION ALL
         SELECT b AS id, a AS other, llm_confidence, llm_reasoning, candidate_method FROM rel
       ),
       per AS (
         SELECT e.id,
                COUNT(DISTINCT e.other) AS related_count,
                AVG(e.llm_confidence)   AS avg_related_confidence,
                jsonb_agg(jsonb_build_object(
                  'id', o.id, 'name', o.canonical_name, 'confidence', e.llm_confidence,
                  'reasoning', left(e.llm_reasoning, 240), 'method', e.candidate_method
                ) ORDER BY e.llm_confidence DESC NULLS LAST, o.canonical_name) AS top_related
           FROM edges e
           JOIN general.entity_golden_records o ON o.id = e.other
          GROUP BY e.id
       )
       SELECT g.id, g.canonical_name, g.entity_type, g.bn_root, g.dataset_sources,
              g.source_summary, g.source_link_count, g.confidence,
              p.related_count, p.avg_related_confidence, p.top_related,
              (SELECT a->>'province' FROM jsonb_array_elements(COALESCE(g.addresses, '[]'::jsonb)) a
                WHERE a->>'province' IS NOT NULL LIMIT 1) AS province
         FROM per p
         JOIN general.entity_golden_records g ON g.id = p.id
        WHERE g.confidence >= $1
          AND p.related_count >= $2${extra}
        ORDER BY p.related_count DESC, g.source_link_count DESC NULLS LAST, g.id
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

function mapRowToMatch(row: RelatedRow): PatternMatch | null {
  const relatedCount = num(row.related_count);
  if (relatedCount < RELATED_FLOOR) return null;
  const linkCount = num(row.source_link_count);
  const sources = row.dataset_sources ?? [];
  const confidence = num(row.confidence);
  const avgRelConf = num(row.avg_related_confidence);
  const top = (row.top_related ?? []).slice(0, 5);

  const name = row.canonical_name ?? "Unknown entity";
  const bn = normalizeBn(row.bn_root);
  const id = bn ?? row.canonical_name ?? String(row.id);
  const rowId = String(row.id);
  const flags = {
    missingBn: bn == null,
    lowConfidence: confidence < 0.85 || (avgRelConf > 0 && avgRelConf < 0.85),
  };
  const severity = severityFor(relatedCount, sources.length, linkCount);
  const counterparts = top.map((t) => t.name ?? `entity ${t.id}`).join("; ");

  return {
    patternId: "related-parties",
    matchId: `related-parties:${id}:${row.id}`,
    subject: { type: "recipient", id, canonicalName: name },
    evidence: [
      { source: "general.entity_merge_candidates", rowId, field: "related_count", value: relatedCount },
      { source: "general.entity_merge_candidates", rowId, field: "avg_related_confidence", value: Number(avgRelConf.toFixed(3)) },
      ...top.map((t) => ({
        source: "general.entity_merge_candidates",
        rowId: String(t.id),
        field: "related_entity",
        value: `${t.name ?? "—"}${t.confidence != null ? ` (${Number(t.confidence).toFixed(2)})` : ""}${t.reasoning ? ` — ${t.reasoning}` : ""}`,
      })),
      { source: "general.entity_golden_records", rowId, field: "dataset_sources", value: sources.join(",") },
      { source: "general.entity_golden_records", rowId, field: "source_link_count", value: linkCount },
      { source: "general.entity_golden_records", rowId, field: "entity_type", value: row.entity_type },
      { source: "general.entity_golden_records", rowId, field: "confidence", value: confidence },
    ],
    calibratedSummary: `The dataset shows ${name}${row.entity_type ? ` (${row.entity_type})` : ""} adjudicated as RELATED to ${relatedCount} other ${relatedCount === 1 ? "entity" : "entities"} by the entity-resolution pipeline (mean verdict confidence ${avgRelConf.toFixed(2)})${counterparts ? ` — ${counterparts}` : ""}; it appears in ${sources.length} ${sources.length === 1 ? "dataset" : "datasets"} (${sources.join(", ") || "—"}) with ${linkCount.toLocaleString("en-CA")} source records. Glassbox surfaces the network; the funder verifies governance overlap.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: relatedCount,
    evidenceStrength: evidenceStrength({ margin: marginOver(relatedCount, RELATED_REFERENCE), flags }),
    benignNote: benignNoteFor("related-parties", { name, flags }),
    department: null,
    province: row.province ?? null,
    fiscalYear: null,
    detectedAt: new Date().toISOString(),
  };
}

export function _mapRelatedPartiesForTest(row: Partial<RelatedRow> & { id: number }): PatternMatch | null {
  return mapRowToMatch({
    canonical_name: null, entity_type: null, bn_root: null, dataset_sources: null, source_summary: null,
    source_link_count: null, confidence: null, related_count: null, avg_related_confidence: null,
    top_related: null, province: null,
    ...row,
  });
}
export const _RELATED_PARTIES_FLOORS_FOR_TEST = { CONFIDENCE_FLOOR, RELATED_FLOOR, RELATED_REFERENCE };
