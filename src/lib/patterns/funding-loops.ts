import { query } from "../db/pool";
import { getPattern } from "./registry";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type SignalStrength,
  meetsMinSignal,
} from "./types";

/**
 * Funding-loops detector. Reads cra.loop_universe — TRACE's pre-computed
 * loop-detection output. Score is calibrated 0–23 by TRACE; ≥12 is the
 * TRACE attention threshold, surfaced here as the Glassbox display floor.
 *
 * Sub-categorization: reciprocal (2-hop dominant), triangular (3-hop),
 * chain (4+ hops). Reported as part of the calibrated summary.
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

const ATTENTION_THRESHOLD = 12;

function severityFor(score: number): SignalStrength {
  // 12–14 observation, 15–17 attention, 18+ flag.
  if (score >= 18) return "flag";
  if (score >= 15) return "attention";
  return "observation";
}

function loopShape(row: LoopUniverseRow): {
  category: "reciprocal" | "triangular" | "chain";
  detail: string;
} {
  const h2 = Number(row.loops_2hop) || 0;
  const h3 = Number(row.loops_3hop) || 0;
  const h4 = Number(row.loops_4hop) || 0;
  const h5 = Number(row.loops_5hop) || 0;
  const h6 = Number(row.loops_6hop) || 0;
  const h7 = Number(row.loops_7plus) || 0;
  const longTail = h4 + h5 + h6 + h7;

  // Pick the dominant hop class. 2-hop is reciprocal, 3-hop triangular,
  // anything beyond is a chain.
  const max = Math.max(h2, h3, longTail);
  if (max === h2) return { category: "reciprocal", detail: `${h2} reciprocal pairs` };
  if (max === h3) return { category: "triangular", detail: `${h3} triangular cycles` };
  return {
    category: "chain",
    detail: `${longTail} chains of length ≥ 4`,
  };
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

function calibratedSummary(row: LoopUniverseRow): string {
  const shape = loopShape(row);
  const total = Number(row.total_loops) || 0;
  const amt = Number(row.total_circular_amt) || 0;
  const score = Number(row.score) || 0;
  return `The dataset shows ${row.legal_name ?? "the entity"} (BN ${row.bn ?? "—"}) participating in ${total} circular money flows totalling ${dollar.format(amt)}; ${shape.detail}; pattern score ${score}/23 per Alberta TRACE methodology.`;
}

export const fundingLoopsDetector: PatternDetector = {
  pattern: getPattern("funding-loops")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [ATTENTION_THRESHOLD];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND bn = $${params.length}`;
    }
    params.push(limit);

    const r = await query<LoopUniverseRow>(
      `SELECT bn, legal_name,
              total_loops, loops_2hop, loops_3hop, loops_4hop,
              loops_5hop, loops_6hop, loops_7plus,
              max_bottleneck, total_circular_amt, score, scored_at
         FROM cra.loop_universe
        WHERE score >= $1${extra}
        ORDER BY score DESC, total_circular_amt DESC NULLS LAST
        LIMIT $${params.length}`,
      params,
    );

    return r.rows
      .map((row) => mapToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapToMatch(row: LoopUniverseRow): PatternMatch | null {
  const score = Number(row.score) || 0;
  if (score < ATTENTION_THRESHOLD) return null;
  const shape = loopShape(row);
  return {
    patternId: "funding-loops",
    matchId: `funding-loops:${row.bn ?? row.legal_name}`,
    subject: {
      type: "recipient",
      id: row.bn ?? row.legal_name ?? "unknown",
      canonicalName: row.legal_name ?? "Unknown entity",
    },
    evidence: [
      {
        source: "cra.loop_universe",
        rowId: row.bn ?? "",
        field: "score",
        value: score,
        asOf: row.scored_at ?? undefined,
      },
      {
        source: "cra.loop_universe",
        rowId: row.bn ?? "",
        field: "total_loops",
        value: Number(row.total_loops) || 0,
      },
      {
        source: "cra.loop_universe",
        rowId: row.bn ?? "",
        field: "total_circular_amt",
        value: Number(row.total_circular_amt) || 0,
      },
      {
        source: "cra.loop_universe",
        rowId: row.bn ?? "",
        field: "loop_shape",
        value: `${shape.category} · ${shape.detail}`,
      },
    ],
    calibratedSummary: calibratedSummary(row),
    signalStrength: severityFor(score),
    detectedAt: new Date().toISOString(),
  };
}

/** Pure helper exported for unit tests — does not touch the DB. */
export function _mapToMatchForTest(row: LoopUniverseRow): PatternMatch | null {
  return mapToMatch(row);
}

export const _ATTENTION_THRESHOLD_FOR_TEST = ATTENTION_THRESHOLD;
