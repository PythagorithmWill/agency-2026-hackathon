import { longQuery } from "../db/pool";
import { hasAppTable } from "../db/features";
import { getPattern, THRESHOLDS } from "./registry";
import { normalizeBn } from "./identity";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type Severity,
  meetsMinSignal,
  asIso,
  fiscalYearOf,
} from "./types";
import { evidenceStrength, benignNoteFor, marginOver, severityToSignalStrength } from "./strength";
import { dollar, num } from "./format";

/**
 * Funding-loops detector (Challenge #3).
 *
 * Primary source (methodology v2): app.gift_loops — hub-aware, temporally
 * ordered simple cycles (≤ 4 hops, whole loop within 12 months) in the
 * ≥ $5K qualified-donee gift graph, recomputed by scripts/refresh-loops.ts.
 * Each loop carries edge weights (gift ÷ donor's total gifts that fiscal
 * year) and score = min edge weight × hops penalty. Matches are per BN:
 * every loop the charity participates in, ranked by its best loop.
 *
 * Fallback: cra.loop_universe — TRACE's pre-computed per-BN loop summary
 * (score 0–23; ≥ 12 is the TRACE attention threshold).
 */

interface LoopUniverseRow {
  bn: string | null;
  legal_name: string | null;
  total_loops: number | string | null;
  loops_2hop: number | string | null;
  loops_3hop: number | string | null;
  loops_4hop: number | string | null;
  loops_5hop: number | string | null;
  loops_6hop: number | string | null;
  loops_7plus: number | string | null;
  max_bottleneck: number | string | null;
  total_circular_amt: number | string | null;
  score: number | string | null;
  scored_at: string | null;
}

interface GiftLoopRow {
  bn: string;
  legal_name: string | null;
  province: string | null;
  total_loops: number | string | null;
  loops_2hop: number | string | null;
  loops_3hop: number | string | null;
  loops_4hop: number | string | null;
  hub_loops: number | string | null;
  best_score: number | string | null;
  total_circular_amt: number | string | null;
  is_hub: boolean | null;
  best_loop_id: number | string | null;
  best_hops: number | string | null;
  best_path_names: string[] | null;
  best_path_bns: string[] | null;
  best_total_amount: number | string | null;
  best_hub_touched: boolean | null;
  best_start_fpe: string | Date | null;
  best_end_fpe: string | Date | null;
  computed_at: string | Date | null;
}

const ATTENTION_THRESHOLD = THRESHOLDS.LOOP_UNIVERSE_SCORE_FLOOR;
const SCORE_FLOOR = THRESHOLDS.LOOP_SCORE_FLOOR;

function severityForUniverse(score: number): Severity {
  if (score >= 21) return "critical";
  if (score >= 18) return "high";
  if (score >= 15) return "medium";
  return "low";
}

function severityForLoop(score: number): Severity {
  if (score >= 0.5) return "critical";
  if (score >= 0.25) return "high";
  if (score >= 0.1) return "medium";
  return "low";
}

function loopShape(row: LoopUniverseRow): { category: "reciprocal" | "triangular" | "chain"; detail: string } {
  const h2 = num(row.loops_2hop);
  const h3 = num(row.loops_3hop);
  const longTail = num(row.loops_4hop) + num(row.loops_5hop) + num(row.loops_6hop) + num(row.loops_7plus);
  const max = Math.max(h2, h3, longTail);
  if (max === h2) return { category: "reciprocal", detail: `${h2} reciprocal pairs` };
  if (max === h3) return { category: "triangular", detail: `${h3} triangular cycles` };
  return { category: "chain", detail: `${longTail} chains of length ≥ 4` };
}

function calibratedSummary(row: LoopUniverseRow): string {
  const shape = loopShape(row);
  const total = num(row.total_loops);
  const amt = num(row.total_circular_amt);
  const score = num(row.score);
  return `The dataset shows ${row.legal_name ?? "the entity"} (BN ${row.bn ?? "—"}) participating in ${total} circular money flows totalling ${dollar.format(amt)}; ${shape.detail}; pattern score ${score}/23 per Alberta TRACE methodology.`;
}

export const fundingLoopsDetector: PatternDetector = {
  pattern: getPattern("funding-loops")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const useLoops = await hasAppTable("gift_loops");
    if (useLoops) {
      const params: unknown[] = [SCORE_FLOOR];
      let extra = "";
      if (filters.subjectId) {
        params.push(filters.subjectId);
        extra = ` AND p.bn = $${params.length}`;
      }
      params.push(limit);
      const r = await longQuery<GiftLoopRow>(
        `WITH member AS (
           SELECT l.loop_id, l.hops, l.score, l.total_amount, l.hub_touched,
                  l.start_fpe, l.end_fpe, l.path_bns, l.path_names, l.computed_at, m.bn
             FROM app.gift_loops l
             CROSS JOIN LATERAL unnest(l.path_bns) AS m(bn)
         ),
         per AS (
           SELECT bn,
                  COUNT(*) AS total_loops,
                  COUNT(*) FILTER (WHERE hops = 2) AS loops_2hop,
                  COUNT(*) FILTER (WHERE hops = 3) AS loops_3hop,
                  COUNT(*) FILTER (WHERE hops = 4) AS loops_4hop,
                  COUNT(*) FILTER (WHERE hub_touched) AS hub_loops,
                  MAX(score) AS best_score,
                  SUM(total_amount) AS total_circular_amt,
                  MAX(computed_at) AS computed_at
             FROM member GROUP BY bn
         ),
         best AS (
           SELECT DISTINCT ON (bn) bn, loop_id AS best_loop_id, hops AS best_hops,
                  path_names AS best_path_names, path_bns AS best_path_bns,
                  total_amount AS best_total_amount, hub_touched AS best_hub_touched,
                  start_fpe AS best_start_fpe, end_fpe AS best_end_fpe
             FROM member
            ORDER BY bn, score DESC, total_amount DESC, loop_id
         )
         SELECT p.*, b.best_loop_id, b.best_hops, b.best_path_names, b.best_path_bns,
                b.best_total_amount, b.best_hub_touched, b.best_start_fpe, b.best_end_fpe,
                (h.bn IS NOT NULL) AS is_hub,
                i.legal_name, i.province
           FROM per p
           JOIN best b USING (bn)
           LEFT JOIN app.gift_hubs h ON h.bn = p.bn
           LEFT JOIN LATERAL (
             SELECT legal_name, province FROM cra.cra_identification ci
              WHERE ci.bn = p.bn ORDER BY fiscal_year DESC LIMIT 1
           ) i ON true
          WHERE p.best_score >= $1${extra}
          ORDER BY p.best_score DESC, p.total_circular_amt DESC, p.bn
          LIMIT $${params.length}`,
        params,
        filters.statementTimeoutMs ?? 60_000,
      );
      return r.rows
        .map((row) => mapGiftLoopToMatch(row))
        .filter((m): m is PatternMatch => m !== null)
        .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
    }

    const params: unknown[] = [ATTENTION_THRESHOLD];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND bn = $${params.length}`;
    }
    params.push(limit);

    const r = await longQuery<LoopUniverseRow>(
      `SELECT bn, legal_name,
              total_loops, loops_2hop, loops_3hop, loops_4hop,
              loops_5hop, loops_6hop, loops_7plus,
              max_bottleneck, total_circular_amt, score, scored_at
         FROM cra.loop_universe
        WHERE score >= $1${extra}
        ORDER BY score DESC, total_circular_amt DESC NULLS LAST
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 30_000,
    );

    return r.rows
      .map((row) => mapToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapGiftLoopToMatch(row: GiftLoopRow): PatternMatch | null {
  const best = num(row.best_score);
  if (best < SCORE_FLOOR) return null;
  const bn = normalizeBn(row.bn) ?? row.bn;
  const name = row.legal_name ?? (row.best_path_names?.[0] ?? "Unknown charity");
  const totalLoops = num(row.total_loops);
  const hubLoops = num(row.hub_loops);
  const amt = num(row.total_circular_amt);
  const bestHops = num(row.best_hops);
  const path = (row.best_path_names ?? []).join(" → ");
  const flags = { hubTouched: Boolean(row.best_hub_touched) || Boolean(row.is_hub) };
  const severity = severityForLoop(best);
  const endIso = asIso(row.best_end_fpe);
  const computedAt = asIso(row.computed_at) ?? undefined;

  return {
    patternId: "funding-loops",
    matchId: `funding-loops:${bn}`,
    subject: { type: "recipient", id: bn, canonicalName: name },
    evidence: [
      { source: "app.gift_loops", rowId: bn, field: "best_loop_score", value: Number(best.toFixed(3)), asOf: computedAt },
      { source: "app.gift_loops", rowId: bn, field: "total_loops", value: totalLoops },
      { source: "app.gift_loops", rowId: bn, field: "loop_shape", value: `${num(row.loops_2hop)} reciprocal · ${num(row.loops_3hop)} triangular · ${num(row.loops_4hop)} 4-hop` },
      { source: "app.gift_loops", rowId: bn, field: "hub_touched_loops", value: hubLoops },
      { source: "app.gift_loops", rowId: bn, field: "total_circular_amt", value: amt },
      { source: "app.gift_loops", rowId: String(row.best_loop_id ?? ""), field: "best_loop_path", value: path || null },
      { source: "app.gift_loops", rowId: String(row.best_loop_id ?? ""), field: "best_loop_amount", value: num(row.best_total_amount) },
      { source: "app.gift_loops", rowId: String(row.best_loop_id ?? ""), field: "best_loop_period", value: `${asIso(row.best_start_fpe)?.slice(0, 10) ?? "—"} → ${endIso?.slice(0, 10) ?? "—"}` },
      { source: "app.gift_hubs", rowId: bn, field: "is_hub", value: row.is_hub ? "true" : "false" },
    ],
    calibratedSummary: `The dataset shows ${name} (BN ${bn}) participating in ${totalLoops} time-ordered circular gift ${totalLoops === 1 ? "flow" : "flows"} totalling ${dollar.format(amt)}; strongest loop ${path ? `(${path}) ` : ""}is ${bestHops} hops with score ${best.toFixed(2)} — at least ${(best * 100).toFixed(0)}% of each donor's giving that year travelled around the loop${hubLoops > 0 ? `; ${hubLoops} of the loops originate at a hub (DAF / community foundation / federated body)` : ""}.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: Number(best.toFixed(3)),
    evidenceStrength: evidenceStrength({ margin: marginOver(best, SCORE_FLOOR), flags }),
    benignNote: benignNoteFor("funding-loops", { name, flags }),
    department: null,
    province: row.province ?? null,
    fiscalYear: fiscalYearOf(endIso),
    detectedAt: new Date().toISOString(),
  };
}

function mapToMatch(row: LoopUniverseRow): PatternMatch | null {
  const score = num(row.score);
  if (score < ATTENTION_THRESHOLD) return null;
  const shape = loopShape(row);
  const bn = normalizeBn(row.bn);
  const name = row.legal_name ?? "Unknown entity";
  const severity = severityForUniverse(score);
  return {
    patternId: "funding-loops",
    matchId: `funding-loops:${bn ?? row.legal_name}`,
    subject: { type: "recipient", id: bn ?? row.legal_name ?? "unknown", canonicalName: name },
    evidence: [
      { source: "cra.loop_universe", rowId: row.bn ?? "", field: "score", value: score, asOf: row.scored_at ?? undefined },
      { source: "cra.loop_universe", rowId: row.bn ?? "", field: "total_loops", value: num(row.total_loops) },
      { source: "cra.loop_universe", rowId: row.bn ?? "", field: "total_circular_amt", value: num(row.total_circular_amt) },
      { source: "cra.loop_universe", rowId: row.bn ?? "", field: "loop_shape", value: `${shape.category} · ${shape.detail}` },
    ],
    calibratedSummary: calibratedSummary(row),
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: score,
    evidenceStrength: evidenceStrength({ margin: marginOver(score, ATTENTION_THRESHOLD), flags: {} }),
    benignNote: benignNoteFor("funding-loops", { name }),
    department: null,
    province: null,
    fiscalYear: null,
    detectedAt: new Date().toISOString(),
  };
}

/** Pure helper exported for unit tests — does not touch the DB. */
export function _mapToMatchForTest(row: LoopUniverseRow): PatternMatch | null {
  return mapToMatch(row);
}
export function _mapGiftLoopForTest(row: Partial<GiftLoopRow> & { bn: string }): PatternMatch | null {
  return mapGiftLoopToMatch({
    legal_name: null, province: null, total_loops: null, loops_2hop: null, loops_3hop: null, loops_4hop: null,
    hub_loops: null, best_score: null, total_circular_amt: null, is_hub: null, best_loop_id: null, best_hops: null,
    best_path_names: null, best_path_bns: null, best_total_amount: null, best_hub_touched: null,
    best_start_fpe: null, best_end_fpe: null, computed_at: null,
    ...row,
  });
}

export const _ATTENTION_THRESHOLD_FOR_TEST = ATTENTION_THRESHOLD;
export const _LOOP_SCORE_FLOOR_FOR_TEST = SCORE_FLOOR;
