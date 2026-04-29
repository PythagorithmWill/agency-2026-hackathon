import type { ProofToken } from "./types";

/**
 * The four scoring dimensions exposed in the Adjust Weights interface.
 * Default weights mirror the heuristic baked into sql/canonical/findings_feed.sql.
 */
export const WEIGHT_DIMENSIONS = [
  {
    id: "federal_concentration",
    label: "Federal concentration",
    blurb: "Cumulative-current commitment + active agreement count",
    default: 6,
  },
  {
    id: "cra_loops",
    label: "CRA loop participation",
    blurb: "max_loop_score + total_loops from cra.loop_universe",
    default: 5,
  },
  {
    id: "t3010_violations",
    label: "T3010 arithmetic violations",
    blurb: "cra.t3010_impossibilities row count for the BN",
    default: 4,
  },
  {
    id: "dataset_cross_coverage",
    label: "Dataset cross-coverage",
    blurb: "Bonus for entities visible in both fed + cra",
    default: 3,
  },
] as const;

export type WeightDimensionId = (typeof WEIGHT_DIMENSIONS)[number]["id"];
export type WeightVector = Record<WeightDimensionId, number>;

export const DEFAULT_WEIGHTS: WeightVector = WEIGHT_DIMENSIONS.reduce(
  (acc, dim) => ({ ...acc, [dim.id]: dim.default }),
  {} as WeightVector,
);

/**
 * Pure recomputation of the composite score given a weight vector. The
 * baseline `originalScore` is preserved so adjusting the sliders is a
 * sensitivity test, not a re-derivation from raw evidence (which we don't
 * carry into the URL state).
 */
export function recalculateScore(
  originalScore: number,
  weights: WeightVector,
): number {
  // Total of the four weights, default-summed = 6+5+4+3 = 18
  const baseline =
    WEIGHT_DIMENSIONS.reduce((s, d) => s + d.default, 0) || 1;
  const adjusted = WEIGHT_DIMENSIONS.reduce((s, d) => s + weights[d.id], 0);
  const ratio = adjusted / baseline;
  // Cap at 30 (the score scale). Apply ratio to the original score.
  return Math.max(0, Math.min(30, Math.round(originalScore * ratio)));
}

export function scoreLabel(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 22) return "CRITICAL";
  if (score >= 14) return "HIGH";
  if (score >= 7) return "MEDIUM";
  return "LOW";
}

/**
 * Construct a chained Proof token. The new token's previousTokenHash points
 * back to the parent's tokenHash (the chain-of-evidence guarantee), and
 * tiers carry an explicit `chainReason` annotation in the audit logRef.
 */
export function chainProofToken(input: {
  parent: ProofToken;
  weights: WeightVector;
  chainReason: string;
  validatorVerdict: { passed: boolean; violationCount: number };
}): ProofToken {
  const { parent, weights, chainReason, validatorVerdict } = input;
  const newScore = recalculateScore(parent.finding.score, weights);
  const newLabel = scoreLabel(newScore);
  const issuedAt = new Date().toISOString();
  const idHash = simpleHash(
    `${parent.proofId}|${JSON.stringify(weights)}|${chainReason}`,
  ).slice(0, 6);
  const newProofId = `ppm-${issuedAt}-chain-${idHash}`;

  return {
    ...parent,
    proofId: newProofId,
    issuedAt,
    issuedBy: "PYTH-LEAD",
    finding: {
      ...parent.finding,
      score: newScore,
      scoreLabel: newLabel,
      summary: `${parent.finding.summary.replace(/[.!?]\s*$/, "")} — re-scored under adjusted weights, sensitivity reason logged.`,
    },
    tiers: {
      ...parent.tiers,
      output: {
        ...parent.tiers.output,
        calibrationCheck: validatorVerdict.passed ? "passed" : "failed",
        languageViolations: validatorVerdict.passed
          ? []
          : [
              `chainReason flagged ${validatorVerdict.violationCount} calibration violation(s)`,
            ],
        passed: validatorVerdict.passed,
      },
      audit: {
        ...parent.tiers.audit,
        passed: validatorVerdict.passed,
        previousTokenHash: parent.tiers.audit.tokenHash,
        tokenHash: `sha256:chain-${idHash}-pending-seal`,
        humanReviewed: false,
        humanReviewer: null,
        operatorAgent: "PYTH-LEAD",
        logRef: `decisions.md#chain-${idHash} (rationale: ${chainReason.slice(0, 80)})`,
      },
    },
  };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Encode a weight vector as a compact URL fragment: fc:8,cl:5,tv:7,dc:6 */
export function encodeWeights(w: WeightVector): string {
  return [
    `fc:${w.federal_concentration}`,
    `cl:${w.cra_loops}`,
    `tv:${w.t3010_violations}`,
    `dc:${w.dataset_cross_coverage}`,
  ].join(",");
}

export function decodeWeights(s: string | null): WeightVector {
  if (!s) return { ...DEFAULT_WEIGHTS };
  const out = { ...DEFAULT_WEIGHTS };
  const map: Record<string, WeightDimensionId> = {
    fc: "federal_concentration",
    cl: "cra_loops",
    tv: "t3010_violations",
    dc: "dataset_cross_coverage",
  };
  for (const piece of s.split(",")) {
    const [k, v] = piece.split(":");
    const dim = map[k];
    if (dim) {
      const n = Number(v);
      if (Number.isFinite(n)) out[dim] = Math.max(0, Math.min(10, Math.round(n)));
    }
  }
  return out;
}
