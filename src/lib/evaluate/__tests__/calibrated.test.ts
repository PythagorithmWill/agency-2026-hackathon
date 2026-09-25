import { describe, expect, it } from "vitest";
import { calibrationFlags } from "@/lib/gov/validators";
import type { CalibrationFlag } from "@/lib/types";
import {
  buildCalibratedDraft,
  deriveCalibratedChanges,
  describeAction,
} from "../calibrated";

const flagsFor = (text: string) => calibrationFlags(text);

describe("deriveCalibratedChanges", () => {
  it("returns an empty list when there are no flags", () => {
    expect(deriveCalibratedChanges("Funding to expand broadband.", [])).toEqual([]);
  });

  it("maps documented phrases to literal replacements, preserving case", () => {
    const text = "The recipient Failed to deliver. The data proves the point.";
    const changes = deriveCalibratedChanges(text, flagsFor(text));
    expect(changes.map((c) => [c.original, c.action, c.replacement])).toEqual([
      ["Failed to", "replace", "Did not, per public records,"],
      ["proves", "replace", "indicates"],
    ]);
    expect(changes[0].n).toBe(1);
    expect(changes[1].n).toBe(2);
    expect(changes[0].type).toBe("CALIBRATION_LEAK");
    expect(changes[0].guidance).toMatch(/dataset does not show/);
  });

  it("removes superlatives and hedges", () => {
    const text = "A stunning $4M was allegedly spent.";
    const changes = deriveCalibratedChanges(text, flagsFor(text));
    expect(changes.map((c) => [c.original, c.action, c.replacement])).toEqual([
      ["stunning", "remove", ""],
      ["allegedly", "remove", ""],
    ]);
  });

  it("marks phrases with no documented drop-in as manual and keeps the flag's guidance", () => {
    const text = "This was fraud. Sources say the minister acted in exchange for a donation.";
    const changes = deriveCalibratedChanges(text, flagsFor(text));
    const byOriginal = Object.fromEntries(changes.map((c) => [c.original.toLowerCase(), c]));
    expect(byOriginal["fraud"].action).toBe("manual");
    expect(byOriginal["fraud"].replacement).toBeNull();
    expect(byOriginal["fraud"].reason).toMatch(/Editorial verdict/);
    expect(byOriginal["sources say"].action).toBe("manual");
    expect(byOriginal["sources say"].reason).toMatch(/cite the source by name/i);
    expect(byOriginal["in exchange for"].action).toBe("manual");
    expect(byOriginal["in exchange for"].guidance).toMatch(/quid-pro-quo/);
  });

  it("rewrites only the causal verb of a FORBIDDEN_CAUSAL match", () => {
    const text = "The lobbying led to a $2M grant in March.";
    const changes = deriveCalibratedChanges(text, flagsFor(text));
    expect(changes).toHaveLength(1);
    expect(changes[0].original).toBe("led to a $2M grant");
    expect(changes[0].replacement).toBe("preceded a $2M grant");
    expect(changes[0].reason).toMatch(/temporal/);
  });

  it("forces overlapping flags to manual instead of double-editing", () => {
    const text = "Money resulted in a grant that failed to help.";
    const flags: CalibrationFlag[] = [
      { type: "CALIBRATION_LEAK", start: 6, end: 24, match: "resulted in a grant" },
      { type: "CALIBRATION_LEAK", start: 20, end: 25, match: "grant" },
    ];
    const changes = deriveCalibratedChanges(text, flags);
    expect(changes[1].action).toBe("manual");
    expect(changes[1].reason).toMatch(/Overlaps change #1/);
  });

  it("drops flags whose offsets fall outside the draft", () => {
    const flags: CalibrationFlag[] = [
      { type: "CALIBRATION_LEAK", start: 50, end: 60, match: "x" },
      { type: "CALIBRATION_LEAK", start: -1, end: 3, match: "x" },
      { type: "CALIBRATION_LEAK", start: 4, end: 4, match: "" },
    ];
    expect(deriveCalibratedChanges("short text", flags)).toEqual([]);
  });

  it("lists non-leak flag types as manual with the type's rationale", () => {
    const flags: CalibrationFlag[] = [
      { type: "QUOTE_TOO_LONG", start: 0, end: 5, match: "quote" },
    ];
    const [c] = deriveCalibratedChanges("quote here", flags);
    expect(c.action).toBe("manual");
    expect(c.reason).toMatch(/15-word/);
    expect(describeAction(c)).toMatch(/manual/);
  });
});

describe("buildCalibratedDraft", () => {
  it("is the identity when there are nothing to change", () => {
    const text = "Records indicate the program met its targets.";
    const d = buildCalibratedDraft(text, flagsFor(text));
    expect(d.text).toBe(text);
    expect(d.changes).toEqual([]);
    expect(d.segments).toEqual([{ text }]);
  });

  it("applies replacements and collapses the space left by removals", () => {
    const text = "The recipient failed to file, and a stunning $4M was certainly lost.";
    const d = buildCalibratedDraft(text, flagsFor(text));
    expect(d.text).toBe(
      "The recipient did not, per public records, file, and a $4M was lost.",
    );
    expect(d.counts).toEqual({ replace: 1, remove: 2, manual: 0 });
    // Every changed segment points at its change; unchanged text has none.
    const changed = d.segments.filter((s) => s.change);
    expect(changed).toHaveLength(3);
    expect(changed.map((s) => s.text)).toEqual(["did not, per public records,", "", ""]);
  });

  it("keeps manual phrases verbatim in the text", () => {
    const text = "This was fraud.";
    const d = buildCalibratedDraft(text, flagsFor(text));
    expect(d.text).toBe(text);
    expect(d.counts.manual).toBe(1);
    expect(d.segments[1]).toMatchObject({ text: "fraud" });
    expect(d.segments[1].change?.action).toBe("manual");
  });

  it("agrees with the change list — segment text equals each change's replacement", () => {
    const text =
      "Officials should have known. The scheme clearly shows waste; many believe it was intentionally hidden.";
    const d = buildCalibratedDraft(text, flagsFor(text));
    for (const seg of d.segments) {
      if (!seg.change) continue;
      if (seg.change.action === "manual") expect(seg.text).toBe(seg.change.original);
      else expect(seg.text).toBe(seg.change.replacement);
    }
    expect(d.text).toBe(
      "Officials is not recorded as having known. The arrangement indicates waste; many believe it was hidden.",
    );
  });
});
