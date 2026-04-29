import type { OutcomeBrief, ProofToken } from "../types";

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
 * The forbidden phrase patterns. These are LOCKED — change them only with
 * explicit operator approval and a log entry. Each pattern is paired with
 * the calibrated replacement we ship instead.
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
 * Calibrated-language sweep — Check 2 in PYTH-GOV's pipeline.
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
 * Citation completeness — Check 1 in PYTH-GOV's pipeline.
 * Every prose sentence must reference at least one citation id.
 */
export function citationCompleteness(brief: OutcomeBrief): Violation[] {
  const violations: Violation[] = [];
  const sourceIds = new Set(brief.sources.map((s) => s.id));
  for (const section of brief.publicSources) {
    for (const sentence of section.sentences) {
      if (sentence.citations.length === 0) {
        violations.push({
          type: "MISSING_CITATION",
          sentence: sentence.text,
          detail: "No citation pointer on a prose sentence.",
        });
        continue;
      }
      for (const c of sentence.citations) {
        if (!sourceIds.has(c)) {
          violations.push({
            type: "MISSING_CITATION",
            sentence: sentence.text,
            detail: `Citation ${c} does not resolve to a source in this brief.`,
          });
        }
      }
    }
  }
  return violations;
}

/**
 * Quote-length and reuse — companion to Check 2.
 * 15 words max per direct quote; one direct quote per source maximum.
 */
export function quoteDiscipline(brief: OutcomeBrief): Violation[] {
  const violations: Violation[] = [];
  const quoteSourceCount = new Map<string, number>();

  for (const section of brief.publicSources) {
    for (const sentence of section.sentences) {
      const directQuotes = extractDirectQuotes(sentence.text);
      for (const q of directQuotes) {
        const wordCount = q.split(/\s+/).filter(Boolean).length;
        if (wordCount > 15) {
          violations.push({
            type: "QUOTE_TOO_LONG",
            sentence: sentence.text,
            match: q,
            detail: `Direct quote is ${wordCount} words; the ceiling is 15.`,
          });
        }
        for (const cit of sentence.citations) {
          const next = (quoteSourceCount.get(cit) ?? 0) + 1;
          quoteSourceCount.set(cit, next);
          if (next > 1) {
            violations.push({
              type: "QUOTE_REUSED",
              sentence: sentence.text,
              match: q,
              detail: `Source ${cit} is quoted directly more than once; one direct quote per source maximum.`,
            });
          }
        }
      }
    }
  }
  return violations;
}

function extractDirectQuotes(text: string): string[] {
  const out: string[] = [];
  // Match curly quotes ("…"), straight quotes ("…"), and the en-quote pair (' …')
  const pairs: [string, string][] = [
    ["“", "”"],
    ["\"", "\""],
    ["‘", "’"],
  ];
  for (const [open, close] of pairs) {
    let i = 0;
    while (i < text.length) {
      const start = text.indexOf(open, i);
      if (start < 0) break;
      const end = text.indexOf(close, start + 1);
      if (end < 0) break;
      out.push(text.slice(start + 1, end));
      i = end + 1;
    }
  }
  return out;
}

/**
 * Proof token completeness — Check 3 in PYTH-GOV's pipeline.
 */
export function proofTokenCompleteness(token: ProofToken | null | undefined): Violation[] {
  if (!token) {
    return [{ type: "PROOF_INCOMPLETE", detail: "No Proof token attached to the output." }];
  }
  const violations: Violation[] = [];

  if (!token.proofId || !token.proofId.startsWith("ppm-")) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "proofId missing or malformed" });
  }
  if (!token.version) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "version missing" });
  }
  if (!token.issuedAt) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "issuedAt missing" });
  }
  if (!token.finding?.summary) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "finding.summary missing" });
  }

  // Tier 1
  if (!token.tiers?.input || !token.tiers.input.filtersApplied?.length) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "tier 1 (input) filters missing" });
  }

  // Tier 2
  if (!token.tiers?.contextual?.model || !token.tiers.contextual.promptVersion) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "tier 2 (contextual) model/promptVersion missing" });
  }

  // Tier 3
  if (
    typeof token.tiers?.output?.citationCount !== "number" ||
    token.tiers.output.calibrationCheck !== "passed"
  ) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "tier 3 (output) calibration not passed or citationCount missing" });
  }
  if (
    typeof token.tiers?.output?.quoteWordCountMax === "number" &&
    token.tiers.output.quoteWordCountMax >= 15
  ) {
    violations.push({ type: "QUOTE_TOO_LONG", detail: "tier 3 quoteWordCountMax >= 15" });
  }

  // Tier 4
  if (!token.tiers?.audit?.tokenHash || !token.tiers.audit.operatorAgent) {
    violations.push({ type: "PROOF_INCOMPLETE", detail: "tier 4 (audit) tokenHash/operator missing" });
  }

  // Disclaimers
  const disc = (token.disclaimers ?? []).join(" ");
  if (!disc.includes("observations from public records")) {
    violations.push({
      type: "PROOF_INCOMPLETE",
      detail: "disclaimers must include the 'observations from public records' line",
    });
  }

  return violations;
}

/**
 * Run the full three-check pipeline on a Brief. Returns combined report.
 */
export function validateBrief(brief: OutcomeBrief): ValidationReport {
  const violations: Violation[] = [];
  // Check 1
  violations.push(...citationCompleteness(brief));
  // Check 2: calibration on every sentence + the finding summary
  const allText = [
    brief.proofToken.finding.summary,
    ...brief.publicSources.flatMap((s) => s.sentences.map((x) => x.text)),
    ...brief.unverifiable.map((u) => u.claim + " " + u.rationale),
    brief.pullQuote?.text ?? "",
  ].join("\n\n");
  violations.push(...calibrationSweep(allText));
  // Check 2 companion: quote discipline
  violations.push(...quoteDiscipline(brief));
  // Check 3
  violations.push(...proofTokenCompleteness(brief.proofToken));
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
