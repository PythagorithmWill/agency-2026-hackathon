import type { ProofToken, CalibrationFlag, EvaluationResult } from "../types";

export type ViolationType =
  | "MISSING_CITATION"
  | "CALIBRATION_LEAK"
  | "PROOF_INCOMPLETE"
  | "QUOTE_TOO_LONG"
  | "QUOTE_REUSED"
  | "LOW_CONFIDENCE_ENTITY";

export interface Violation {
  type: ViolationType;
  sentence?: string;
  match?: string;
  detail?: string;
  rewrite?: string;
}

export interface ValidationReport {
  passed: boolean;
  violations: Violation[];
}

/**
 * The forbidden phrase patterns. LOCKED — change them only with explicit
 * operator approval and a `decisions.md` entry. Each pattern is paired
 * with the calibrated replacement we ship instead.
 */
export const FORBIDDEN_ABSOLUTE: { pattern: RegExp; rewrite: string }[] = [
  { pattern: /\b(fraud|fraudulent|corrupt(?:ion)?|crime|criminal|illegal(?:ly)?)\b/i, rewrite: "(drop the editorial verdict; use 'pattern consistent with…' or cite the specific source making the claim)" },
  { pattern: /\b(should have|ought to have|was supposed to)\b/i, rewrite: "Use 'comparable filings typically state…' or 'records do not contain…'" },
  { pattern: /\b(proves?|proven|definitely|certainly|clearly shows?)\b/i, rewrite: "Use 'records indicate…' or 'the dataset shows…'" },
  { pattern: /\b(failed to|refused to|deliberately|intentionally|knowingly)\b/i, rewrite: "Use 'the dataset does not show…' or 'public records do not contain…'" },
  { pattern: /\b(coverups?|cover[- ]ups?|schemes?|scams?)\b/i, rewrite: "Drop the editorial framing; describe the documented pattern" },
  { pattern: /\b(stunning|shocking|egregious|alarming|massive amounts? of public money|astronomical)\b/i, rewrite: "Drop the superlative; let the number speak" },
  { pattern: /\b(allegedly|reportedly|sources say|many believe|it is widely known)\b/i, rewrite: "Drop the hedge and cite the specific source by name" },
];

export const FORBIDDEN_CAUSAL: { pattern: RegExp; rewrite: string }[] = [
  { pattern: /\bbecause of\b[^.]{0,80}\b(grant|contract|funding|donation|lobbying)\b/i, rewrite: "Use temporal description: 'X occurred N days before Y'" },
  { pattern: /\b(caused|led to|resulted in)\b[^.]{0,80}\b(grant|contract|funding)\b/i, rewrite: "Replace causal verb with 'preceded' / 'followed' or cite the source asserting the causation" },
  { pattern: /\bin (?:exchange|return) for\b/i, rewrite: "Drop. This phrasing is a quid-pro-quo claim and is unsupported." },
  { pattern: /\b(this raises serious questions|warrants investigation|warrants further investigation|the public deserves answers|officials should explain)\b/i, rewrite: "Drop. The reader-direction is the reader's call, not ours." },
];

/**
 * Calibrated-language sweep. Used by PYTH-GOV as Check 2 in the validator
 * pipeline AND inline in the UI to highlight forbidden phrases as the
 * user types a draft.
 */
export function calibrationSweep(text: string): Violation[] {
  const violations: Violation[] = [];
  for (const f of FORBIDDEN_ABSOLUTE) {
    const m = text.match(f.pattern);
    if (m) {
      violations.push({
        type: "CALIBRATION_LEAK",
        match: m[0],
        sentence: nearestSentence(text, m.index ?? 0),
        rewrite: f.rewrite,
      });
    }
  }
  for (const f of FORBIDDEN_CAUSAL) {
    const m = text.match(f.pattern);
    if (m) {
      violations.push({
        type: "CALIBRATION_LEAK",
        match: m[0],
        sentence: nearestSentence(text, m.index ?? 0),
        rewrite: f.rewrite,
      });
    }
  }
  return violations;
}

/**
 * Position-aware variant — used by the inline highlight on /evaluate so we
 * can underline the exact substring and show the rewrite in a tooltip.
 */
export function calibrationFlags(text: string): CalibrationFlag[] {
  const out: CalibrationFlag[] = [];
  const seen = new Set<string>();
  for (const f of [...FORBIDDEN_ABSOLUTE, ...FORBIDDEN_CAUSAL]) {
    const re = new RegExp(f.pattern.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = `${m.index}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        type: "CALIBRATION_LEAK",
        start: m.index,
        end: m.index + m[0].length,
        match: m[0],
        rewrite: f.rewrite,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Proof token completeness — Check 3 in PYTH-GOV's pipeline. */
export function proofTokenCompleteness(
  token: ProofToken | null | undefined,
): Violation[] {
  if (!token) {
    return [{ type: "PROOF_INCOMPLETE", detail: "No Proof token attached." }];
  }
  const v: Violation[] = [];

  if (!token.proofId || !token.proofId.startsWith("ppm-")) {
    v.push({ type: "PROOF_INCOMPLETE", detail: "proofId missing or malformed" });
  }
  if (!token.version) v.push({ type: "PROOF_INCOMPLETE", detail: "version missing" });
  if (!token.issuedAt) v.push({ type: "PROOF_INCOMPLETE", detail: "issuedAt missing" });
  if (!token.finding?.summary) v.push({ type: "PROOF_INCOMPLETE", detail: "finding.summary missing" });

  if (!token.tiers?.input || !token.tiers.input.filtersApplied?.length) {
    v.push({ type: "PROOF_INCOMPLETE", detail: "tier 1 (input) filters missing" });
  }
  if (!token.tiers?.contextual?.model || !token.tiers.contextual.promptVersion) {
    v.push({ type: "PROOF_INCOMPLETE", detail: "tier 2 (contextual) model/promptVersion missing" });
  }
  if (
    typeof token.tiers?.output?.citationCount !== "number" ||
    token.tiers.output.calibrationCheck !== "passed"
  ) {
    v.push({
      type: "PROOF_INCOMPLETE",
      detail: "tier 3 (output) calibration not passed or citationCount missing",
    });
  }
  if (
    typeof token.tiers?.output?.quoteWordCountMax === "number" &&
    token.tiers.output.quoteWordCountMax >= 15
  ) {
    v.push({ type: "QUOTE_TOO_LONG", detail: "tier 3 quoteWordCountMax >= 15" });
  }
  if (!token.tiers?.audit?.tokenHash || !token.tiers.audit.operatorAgent) {
    v.push({ type: "PROOF_INCOMPLETE", detail: "tier 4 (audit) tokenHash/operator missing" });
  }
  const disc = (token.disclaimers ?? []).join(" ");
  if (!disc.includes("observations from public records")) {
    v.push({
      type: "PROOF_INCOMPLETE",
      detail: "disclaimers must include 'observations from public records' line",
    });
  }
  return v;
}

/** Run the full pipeline on an EvaluationResult before it ships. */
export function validateEvaluation(e: EvaluationResult): ValidationReport {
  const violations: Violation[] = [];
  const allText = [
    e.recommendation.text,
    e.proofToken.finding.summary,
    e.awardeeConcentration.observation,
    ...Object.values(e.suitability.perComponentExplanation),
  ].join("\n\n");
  violations.push(...calibrationSweep(allText));
  violations.push(...proofTokenCompleteness(e.proofToken));
  return { passed: violations.length === 0, violations };
}

function nearestSentence(text: string, charIndex: number): string {
  const start = Math.max(0, text.lastIndexOf(".", charIndex - 1) + 1);
  const end = (() => {
    const p = text.indexOf(".", charIndex);
    return p > 0 ? p + 1 : Math.min(text.length, charIndex + 100);
  })();
  return text.slice(start, end).trim();
}
