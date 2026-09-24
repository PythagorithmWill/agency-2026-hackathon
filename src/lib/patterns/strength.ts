import { FP, nameFalsePositive, type FalsePositiveKey } from "./false-positives";
import { getPattern } from "./registry";

/**
 * Evidence strength — one shared formula for every detector.
 *
 *   strength = clamp01( base(margin) × Π (1 − penalty_i) )
 *
 *   margin       = (signal − threshold) / |threshold|        (≥ 0 at threshold)
 *   base(margin) = 0.5 + 0.5 × (1 − e^(−margin))
 *                  → 0.50 exactly at the threshold, 0.82 at 2× the
 *                    threshold, 0.93 at 3×, asymptotically 1.0.
 *   penalty_i    = data-quality discount for each flag raised on the
 *                  rows behind the match (table below). Flags multiply,
 *                  so two independent defects compound.
 *
 * When the threshold is 0 or the detector has no meaningful margin
 * (e.g. a binary condition), pass `margin` directly.
 *
 * The output is rounded to 3 decimals to match numeric(4,3) in
 * app.pattern_matches.
 */
export interface DataQualityFlags {
  /** BN present but a publisher placeholder ("0", all-zeros, "-", "n/a"). F-6. */
  placeholderBn?: boolean;
  /** No BN at all where one is expected. F-7. */
  missingBn?: boolean;
  /** Subject grouped/identified by legal name only. F-6 / C-3. */
  nameOnlyIdentity?: boolean;
  /** Duplicate (ref_number, amendment_number) rows in the chain. F-2. */
  duplicateRows?: boolean;
  /** Negative agreement values in the chain / negative gifts. F-4 / C-4. */
  negativeValues?: boolean;
  /** ref_number shared across unrelated recipients. F-1. */
  refCollision?: boolean;
  /** Gift loop passes through / originates at a hub (DAF, community foundation). */
  hubTouched?: boolean;
  /** Program has a single recipient (HHI = 10,000 by construction). */
  singleRecipient?: boolean;
  /** Golden-record confidence below 0.85. */
  lowConfidence?: boolean;
  /** Percentile threshold computed over fewer than MIN_GROUP peers. */
  smallGroup?: boolean;
  /** Plausibility flag: amount dwarfs the donor's revenue (C-2). */
  unitErrorSuspect?: boolean;
  /** Unregistered donee BN (C-11). */
  unregisteredDonee?: boolean;
}

export const PENALTIES: Record<keyof DataQualityFlags, number> = {
  placeholderBn: 0.3,
  missingBn: 0.3,
  nameOnlyIdentity: 0.2,
  duplicateRows: 0.25,
  negativeValues: 0.25,
  refCollision: 0.2,
  hubTouched: 0.35,
  singleRecipient: 0.3,
  lowConfidence: 0.15,
  smallGroup: 0.2,
  unitErrorSuspect: 0.4,
  unregisteredDonee: 0.2,
};

/** A percentile computed over fewer peers than this is flagged `smallGroup`. */
export const MIN_GROUP = 10;

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/** Relative margin over a threshold; 0 when at/below the threshold. */
export function marginOver(signal: number, threshold: number): number {
  if (!Number.isFinite(signal) || !Number.isFinite(threshold) || threshold === 0) return 0;
  return Math.max(0, (signal - threshold) / Math.abs(threshold));
}

export function baseFromMargin(margin: number): number {
  if (Number.isNaN(margin)) return 0.5;
  const m = Math.max(0, margin); // +Infinity → base 1.0
  return 0.5 + 0.5 * (1 - Math.exp(-m));
}

export function penaltyFactor(flags: DataQualityFlags = {}): number {
  let f = 1;
  for (const [k, on] of Object.entries(flags)) {
    if (on) f *= 1 - (PENALTIES[k as keyof DataQualityFlags] ?? 0);
  }
  return f;
}

export function evidenceStrength(input: {
  signal?: number;
  threshold?: number;
  /** Pre-computed margin; overrides signal/threshold when given. */
  margin?: number;
  flags?: DataQualityFlags;
}): number {
  const margin =
    input.margin !== undefined
      ? input.margin
      : marginOver(input.signal ?? 0, input.threshold ?? 0);
  const raw = baseFromMargin(margin) * penaltyFactor(input.flags);
  return Math.round(clamp01(raw) * 1000) / 1000;
}

/* ─── benign notes ─────────────────────────────────────────────────── */

/** Flag → note key, in priority order (largest discounts first). */
const FLAG_NOTE_ORDER: Array<[keyof DataQualityFlags, FalsePositiveKey]> = [
  ["unitErrorSuspect", "UNIT_ERROR"],
  ["hubTouched", "DAF_PLATFORM"],
  ["placeholderBn", "PLACEHOLDER_BN"],
  ["missingBn", "PLACEHOLDER_BN"],
  ["singleRecipient", "SINGLE_RECIPIENT_PROGRAM"],
  ["duplicateRows", "DUPLICATE_ROWS"],
  ["negativeValues", "NEGATIVE_VALUES"],
  ["nameOnlyIdentity", "NAME_ONLY_IDENTITY"],
  ["refCollision", "REF_COLLISION"],
  ["unregisteredDonee", "UNREGISTERED_DONEE"],
];

/**
 * Pick the single most applicable false-positive note for a match, or
 * null. Only notes the pattern lists in its registry entry
 * (`falsePositiveNotes`) are eligible. Priority:
 *   1. detector-supplied `preferred` keys (situational, e.g. ONE_OFF_CAPITAL)
 *   2. a name-pattern hit on the subject (DAF, community foundation, diocese …)
 *   3. data-quality flags, largest discount first
 *   4. a pattern-wide caveat listed under `always` (e.g. KEYWORD_PROXY)
 */
export function benignNoteFor(
  patternId: string,
  ctx: {
    name?: string | null;
    flags?: DataQualityFlags;
    preferred?: FalsePositiveKey[];
    always?: FalsePositiveKey[];
  } = {},
): string | null {
  const allowed = new Set(getPattern(patternId)?.falsePositiveNotes ?? []);
  const tryKey = (k: FalsePositiveKey | null): string | null =>
    k && allowed.has(FP[k]) ? FP[k] : null;

  for (const k of ctx.preferred ?? []) {
    const n = tryKey(k);
    if (n) return n;
  }
  const byName = tryKey(nameFalsePositive(ctx.name));
  if (byName) return byName;
  for (const [flag, key] of FLAG_NOTE_ORDER) {
    if (ctx.flags?.[flag]) {
      const n = tryKey(key);
      if (n) return n;
    }
  }
  for (const k of ctx.always ?? []) {
    const n = tryKey(k);
    if (n) return n;
  }
  return null;
}

/** Severity (4 bands, stored) → legacy 3-band signalStrength. */
export function severityToSignalStrength(
  s: "low" | "medium" | "high" | "critical",
): "observation" | "attention" | "flag" {
  if (s === "critical" || s === "high") return "flag";
  if (s === "medium") return "attention";
  return "observation";
}

export function signalStrengthToSeverity(
  s: "observation" | "attention" | "flag" | string | undefined,
): "low" | "medium" | "high" | "critical" {
  if (s === "flag") return "high";
  if (s === "attention") return "medium";
  return "low";
}
