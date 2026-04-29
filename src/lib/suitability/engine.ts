import type {
  ComparableRecord,
  AwardeeConcentration,
  CalibrationFlag,
  SuitabilityScore,
  Verdict,
  DraftSubmission,
} from "../types";

/**
 * Suitability scoring engine — composite 0–30 across four 0–10 components.
 * Pure function: given the retrieved comparables, the awardee
 * concentration aggregate, and the calibration flags found in the draft,
 * returns the four sub-scores, the composite, and the verdict.
 */

const DEFAULT_WEIGHTS = {
  uniqueness: 0.25,
  duplicationRisk: 0.25,
  recipientConcentration: 0.25,
  languageCalibration: 0.25,
} as const;

export function scoreSubmission(input: {
  draft: DraftSubmission;
  comparables: ComparableRecord[];
  concentration: AwardeeConcentration;
  flags: CalibrationFlag[];
  weights?: Partial<typeof DEFAULT_WEIGHTS>;
}): SuitabilityScore {
  const w = { ...DEFAULT_WEIGHTS, ...input.weights };

  const uniqueness = scoreUniqueness(input.comparables);
  const duplicationRisk = scoreDuplicationRisk(input.comparables, input.draft);
  const recipientConcentration = scoreRecipientConcentration(input.concentration);
  const languageCalibration = scoreLanguageCalibration(input.flags);

  // Composite is a 0-30 figure: each component 0-10, weighted, then scaled by 3.
  const composite = clamp(
    Math.round(
      3 *
        (uniqueness * w.uniqueness +
          (10 - duplicationRisk) * w.duplicationRisk +
          (10 - recipientConcentration) * w.recipientConcentration +
          languageCalibration * w.languageCalibration),
    ),
    0,
    30,
  );

  const verdict: Verdict =
    composite >= 25
      ? "PROCEED"
      : composite >= 15
        ? "CONSOLIDATE"
        : "DECLINE AS DUPLICATIVE";

  return {
    uniqueness,
    duplicationRisk,
    recipientConcentration,
    languageCalibration,
    composite,
    verdict,
    weights: w,
    perComponentExplanation: {
      uniqueness: explainUniqueness(uniqueness, input.comparables),
      duplicationRisk: explainDuplicationRisk(duplicationRisk, input.comparables),
      recipientConcentration: explainRecipientConcentration(
        recipientConcentration,
        input.concentration,
      ),
      languageCalibration: explainLanguageCalibration(
        languageCalibration,
        input.flags,
      ),
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Component scorers
   ───────────────────────────────────────────────────────────────────── */

export function scoreUniqueness(comparables: ComparableRecord[]): number {
  if (comparables.length === 0) return 10;
  const top = Math.max(...comparables.slice(0, 20).map((c) => c.similarity));
  return clamp(round(10 - top * 10), 0, 10);
}

export function scoreDuplicationRisk(
  comparables: ComparableRecord[],
  draft: DraftSubmission,
): number {
  const fy = draft.anticipatedFiscalYear;
  const sameProgramAdjacent = comparables.filter(
    (c) =>
      c.similarity >= 0.75 &&
      Math.abs(c.fiscalYear - fy) <= 1 &&
      c.awardingDept === draft.awardingDepartment,
  ).length;
  if (sameProgramAdjacent === 0) return 0;
  if (sameProgramAdjacent <= 3) return 3;
  if (sameProgramAdjacent <= 10) return 6;
  return 10;
}

export function scoreRecipientConcentration(
  concentration: AwardeeConcentration,
): number {
  const hhi = concentration.hhi; // 0..1
  if (hhi < 0.15) return clamp(round(hhi * 20), 1, 3);
  if (hhi < 0.25) return clamp(round(4 + (hhi - 0.15) * 20), 4, 6);
  return clamp(round(7 + (hhi - 0.25) * 12), 7, 10);
}

export function scoreLanguageCalibration(flags: CalibrationFlag[]): number {
  return clamp(10 - flags.length, 0, 10);
}

/* ─────────────────────────────────────────────────────────────────────────
   Explanations — calibrated language only
   ───────────────────────────────────────────────────────────────────── */

function explainUniqueness(
  score: number,
  comparables: ComparableRecord[],
): string {
  if (comparables.length === 0) {
    return "The dataset does not contain comparable records for this draft.";
  }
  const top = comparables[0];
  return `The closest existing record has similarity ${top.similarity.toFixed(2)} (${top.recipientLegalName}, ${top.fiscalYear}, ${top.awardingDept}). Uniqueness scores ${score.toFixed(0)} of 10.`;
}

function explainDuplicationRisk(
  score: number,
  comparables: ComparableRecord[],
): string {
  const high = comparables.filter((c) => c.similarity >= 0.75).length;
  return `The dataset shows ${high} comparable records with similarity ≥0.75 across the program family. Duplication risk scores ${score.toFixed(0)} of 10.`;
}

function explainRecipientConcentration(
  score: number,
  concentration: AwardeeConcentration,
): string {
  return concentration.observation;
}

function explainLanguageCalibration(
  score: number,
  flags: CalibrationFlag[],
): string {
  if (flags.length === 0) {
    return "The draft text contains no phrases that the calibrated-language regex set flags as absolute, causal, or editorial.";
  }
  return `The calibrated-language sweep returned ${flags.length} flagged phrase${flags.length === 1 ? "" : "s"}. Calibration scores ${score.toFixed(0)} of 10.`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────── */

export function computeHHI(
  shares: ReadonlyArray<{ totalAwarded: number }>,
): number {
  const total = shares.reduce((s, r) => s + Math.max(0, r.totalAwarded), 0);
  if (total <= 0) return 0;
  return shares.reduce((s, r) => {
    const p = Math.max(0, r.totalAwarded) / total;
    return s + p * p;
  }, 0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round(n: number): number {
  return Math.round(n);
}
