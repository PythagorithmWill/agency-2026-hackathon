import type { CalibrationFlag, CalibrationFlagType } from "../types";

/**
 * Calibrated-draft derivation.
 *
 * `CalibrationFlag` carries the flagged span and the validator's *guidance*
 * string (e.g. "Use 'records indicate…'"), not a literal replacement. This
 * module turns each flag into a concrete, deterministic change using the
 * lexicon in `.claude/skills/calibrated-accountability-language-skill.md`
 * and the rewrite notes in `src/lib/gov/validators.ts`.
 *
 * Rules:
 *   - A change is only "replace"/"remove" when the lexicon has a documented
 *     drop-in for the exact matched phrase. Everything else is "manual":
 *     the original phrase is kept verbatim in the calibrated text and the
 *     change list repeats what the flag says. We never invent a rewrite.
 *   - Output is a pure function of (draftText, flags) so the UI and the
 *     .docx export always agree.
 */

export type ChangeAction = "replace" | "remove" | "manual";

export interface CalibratedChange {
  /** 1-based position in the ordered list. */
  n: number;
  type: CalibrationFlagType;
  action: ChangeAction;
  /** Offsets into the ORIGINAL draft. */
  start: number;
  end: number;
  original: string;
  /** Literal text placed in the calibrated draft. `null` for manual. */
  replacement: string | null;
  /** One line of why, from the lexicon or the flag's rationale. */
  reason: string;
  /** The validator's own rewrite note, verbatim, when present. */
  guidance?: string;
}

export interface CalibratedSegment {
  text: string;
  /** Present when this segment is the output of a change. */
  change?: CalibratedChange;
}

export interface CalibratedDraft {
  text: string;
  segments: CalibratedSegment[];
  changes: CalibratedChange[];
  counts: Record<ChangeAction, number>;
}

interface LexiconEntry {
  action: ChangeAction;
  replacement?: string;
  reason: string;
}

const REMOVE_EDITORIAL: LexiconEntry = {
  action: "remove",
  reason: "Editorial superlative — drop it and let the number speak.",
};
const REMOVE_INTENT: LexiconEntry = {
  action: "remove",
  reason: "Imputes intent the dataset cannot show — drop the adverb.",
};
const REMOVE_CERTAINTY: LexiconEntry = {
  action: "remove",
  reason: "Absolute certainty the data cannot support — drop the intensifier.",
};
const REMOVE_HEDGE: LexiconEntry = {
  action: "remove",
  reason: "Hedge standing in for a citation — drop it and cite the source by name.",
};
const NOT_RECORDED: LexiconEntry = {
  action: "replace",
  replacement: "is not recorded as having",
  reason: "Obligation claim → scope-limited record observation.",
};
const DID_NOT_PER_RECORDS: LexiconEntry = {
  action: "replace",
  replacement: "did not, per public records,",
  reason: "Failure/refusal verb → what the public records do and do not show.",
};
const PRECEDED: LexiconEntry = {
  action: "replace",
  replacement: "preceded",
  reason: "Causal verb → temporal description (confirm the dates; cite any source asserting causation).",
};

/**
 * Exact-phrase lexicon, keyed by the lower-cased match the locked regex set
 * can produce. Anything the regex can match that is NOT here is manual.
 */
const LEXICON: Record<string, LexiconEntry> = {
  // FORBIDDEN_ABSOLUTE 2 — obligation
  "should have": NOT_RECORDED,
  "ought to have": NOT_RECORDED,
  // FORBIDDEN_ABSOLUTE 3 — certainty
  prove: { action: "replace", replacement: "indicate", reason: "Proof claim → 'records indicate' framing." },
  proves: { action: "replace", replacement: "indicates", reason: "Proof claim → 'records indicate' framing." },
  proven: { action: "replace", replacement: "documented", reason: "Proof claim → what the documents show." },
  definitely: REMOVE_CERTAINTY,
  certainly: REMOVE_CERTAINTY,
  "clearly shows": { action: "replace", replacement: "indicates", reason: "Certainty verb → 'records indicate' framing." },
  "clearly show": { action: "replace", replacement: "indicate", reason: "Certainty verb → 'records indicate' framing." },
  // FORBIDDEN_ABSOLUTE 4 — failure / intent
  "failed to": DID_NOT_PER_RECORDS,
  "refused to": DID_NOT_PER_RECORDS,
  deliberately: REMOVE_INTENT,
  intentionally: REMOVE_INTENT,
  knowingly: REMOVE_INTENT,
  // FORBIDDEN_ABSOLUTE 5 — editorial nouns with a neutral equivalent
  scheme: { action: "replace", replacement: "arrangement", reason: "Loaded noun → neutral description of the documented arrangement." },
  schemes: { action: "replace", replacement: "arrangements", reason: "Loaded noun → neutral description of the documented arrangement." },
  // FORBIDDEN_ABSOLUTE 6 — superlatives
  stunning: REMOVE_EDITORIAL,
  shocking: REMOVE_EDITORIAL,
  egregious: REMOVE_EDITORIAL,
  alarming: REMOVE_EDITORIAL,
  astronomical: REMOVE_EDITORIAL,
  "massive amount of public money": { action: "replace", replacement: "public funds", reason: "Superlative quantity → factual noun; state the figure." },
  "massive amounts of public money": { action: "replace", replacement: "public funds", reason: "Superlative quantity → factual noun; state the figure." },
  // FORBIDDEN_ABSOLUTE 7 — hedges
  allegedly: REMOVE_HEDGE,
  reportedly: REMOVE_HEDGE,
  // FORBIDDEN_CAUSAL 4 — reader-direction with a documented substitution
  "this raises serious questions": {
    action: "replace",
    replacement: "these data raise questions",
    reason: "Editorial → neutral framing (skill lexicon).",
  },
};

/** Causal verbs that open a FORBIDDEN_CAUSAL 2 match; the rest of the span is kept. */
const CAUSAL_LEAD = /^(caused|led to|resulted in)\b/i;

const TYPE_REASON: Record<CalibrationFlagType, string> = {
  CALIBRATION_LEAK: "Phrase matches the locked calibrated-language regex set.",
  MISSING_CITATION: "Claim needs a named source — no automatic rewrite.",
  PROOF_INCOMPLETE: "Proof token field missing — not a text change.",
  QUOTE_TOO_LONG: "Quoted passage exceeds the 15-word limit — shorten the quote.",
  QUOTE_REUSED: "Quote already used elsewhere — cite a different passage.",
  LOW_CONFIDENCE_ENTITY: "Entity resolution is low-confidence — verify the name before publishing.",
};

function manualReasonFor(flag: CalibrationFlag): string {
  if (flag.type !== "CALIBRATION_LEAK") return TYPE_REASON[flag.type];
  const m = flag.match.toLowerCase();
  if (/^(fraud|fraudulent|corrupt|corruption|crime|criminal|illegal|illegally)$/.test(m)) {
    return "Editorial verdict — describe the documented pattern or cite the source making the claim.";
  }
  if (/^was supposed to$/.test(m)) {
    return "Obligation claim — restate as what the agreement terms record, or what records do not contain.";
  }
  if (/^(cover[- ]?ups?|scams?)$/.test(m)) {
    return "Editorial framing — describe the documented pattern instead.";
  }
  if (/^(sources say|many believe|it is widely known)$/.test(m)) {
    return "Anonymous authority — cite the source by name.";
  }
  if (/^because of\b/.test(m)) {
    return "Causal claim — restate as a temporal description ('X occurred N days before Y').";
  }
  if (/^in (exchange|return) for$/.test(m)) {
    return "Quid-pro-quo claim — unsupported; drop and restructure the sentence.";
  }
  if (/^(warrants (further )?investigation|the public deserves answers|officials should explain)$/.test(m)) {
    return "Reader-direction — the reader's call, not ours; drop the clause.";
  }
  return TYPE_REASON.CALIBRATION_LEAK;
}

function matchCase(original: string, replacement: string): string {
  if (replacement.length === 0) return replacement;
  const first = original.charAt(0);
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Turn flags into an ordered change list. Overlapping flags (a later flag
 * starting inside an earlier span) are listed but forced to "manual" so
 * the text can be rebuilt without double-editing one region.
 */
export function deriveCalibratedChanges(
  draftText: string,
  flags: ReadonlyArray<CalibrationFlag>,
): CalibratedChange[] {
  const sorted = [...flags]
    .filter(
      (f) =>
        Number.isInteger(f.start) &&
        Number.isInteger(f.end) &&
        f.start >= 0 &&
        f.end > f.start &&
        f.end <= draftText.length,
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: CalibratedChange[] = [];
  let lastEnd = -1;
  for (const f of sorted) {
    const original = draftText.slice(f.start, f.end);
    const base = {
      n: out.length + 1,
      type: f.type,
      start: f.start,
      end: f.end,
      original,
      guidance: f.rewrite,
    };
    if (f.start < lastEnd) {
      out.push({
        ...base,
        action: "manual",
        replacement: null,
        reason: `Overlaps change #${out.length} — resolve that one first.`,
      });
      continue;
    }
    lastEnd = f.end;

    if (f.type !== "CALIBRATION_LEAK") {
      out.push({ ...base, action: "manual", replacement: null, reason: manualReasonFor(f) });
      continue;
    }

    const key = original.toLowerCase().replace(/\s+/g, " ");
    const entry = LEXICON[key];
    if (entry) {
      const replacement =
        entry.action === "remove" ? "" : matchCase(original, entry.replacement ?? "");
      out.push({ ...base, action: entry.action, replacement, reason: entry.reason });
      continue;
    }
    const causal = CAUSAL_LEAD.exec(original);
    if (causal) {
      const rest = original.slice(causal[0].length);
      out.push({
        ...base,
        action: "replace",
        replacement: matchCase(original, PRECEDED.replacement ?? "") + rest,
        reason: PRECEDED.reason,
      });
      continue;
    }
    out.push({ ...base, action: "manual", replacement: null, reason: manualReasonFor(f) });
  }
  return out;
}

/**
 * Apply the derived changes to the draft. Removals also consume one
 * adjacent space so "the stunning $4M" becomes "the $4M", not "the  $4M".
 */
export function buildCalibratedDraft(
  draftText: string,
  flags: ReadonlyArray<CalibrationFlag>,
): CalibratedDraft {
  const changes = deriveCalibratedChanges(draftText, flags);
  const segments: CalibratedSegment[] = [];
  const counts: Record<ChangeAction, number> = { replace: 0, remove: 0, manual: 0 };
  let cursor = 0;

  for (const c of changes) {
    counts[c.action] += 1;
    if (c.start < cursor) continue; // overlap — already covered
    let start = c.start;
    let end = c.end;
    if (c.action === "remove") {
      // Prefer eating the preceding space so a footnote marker rendered at
      // the removal point sits on the previous word: "a² $4M", not "a ²$4M".
      if (draftText[start - 1] === " " && start - 1 >= cursor) start -= 1;
      else if (draftText[end] === " ") end += 1;
    }
    if (start > cursor) segments.push({ text: draftText.slice(cursor, start) });
    if (c.action === "manual") {
      segments.push({ text: draftText.slice(start, end), change: c });
    } else if (c.action === "remove") {
      segments.push({ text: "", change: c });
    } else {
      segments.push({ text: c.replacement ?? "", change: c });
    }
    cursor = end;
  }
  if (cursor < draftText.length) segments.push({ text: draftText.slice(cursor) });

  return {
    text: segments.map((s) => s.text).join(""),
    segments,
    changes,
    counts,
  };
}

/** Short human label for a change action, shared by UI and .docx. */
export function describeAction(c: CalibratedChange): string {
  switch (c.action) {
    case "replace":
      return "Replaced";
    case "remove":
      return "Removed";
    case "manual":
      return "Kept — needs manual edit";
  }
}
