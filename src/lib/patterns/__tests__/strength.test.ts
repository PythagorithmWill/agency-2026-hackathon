import { describe, it, expect } from "vitest";
import {
  evidenceStrength,
  baseFromMargin,
  marginOver,
  penaltyFactor,
  benignNoteFor,
  PENALTIES,
  severityToSignalStrength,
  signalStrengthToSeverity,
} from "../strength";
import { FP, nameFalsePositive } from "../false-positives";
import { PATTERNS } from "../registry";

describe("strength — margin and base", () => {
  it("margin is 0 at or below the threshold and relative above it", () => {
    expect(marginOver(3, 3)).toBe(0);
    expect(marginOver(2, 3)).toBe(0);
    expect(marginOver(6, 3)).toBe(1);
    expect(marginOver(9, 3)).toBe(2);
    expect(marginOver(5, 0)).toBe(0); // zero threshold → no meaningful margin
  });

  it("base(margin) is 0.5 at the threshold and rises toward 1", () => {
    expect(baseFromMargin(0)).toBe(0.5);
    expect(baseFromMargin(1)).toBeCloseTo(0.5 + 0.5 * (1 - Math.exp(-1)), 6); // ≈ 0.816
    expect(baseFromMargin(3)).toBeCloseTo(0.975, 2);
    expect(baseFromMargin(50)).toBeLessThanOrEqual(1);
    expect(baseFromMargin(-5)).toBe(0.5); // negative margins clamp to 0
    expect(baseFromMargin(NaN)).toBe(0.5);
  });
});

describe("strength — data-quality penalties", () => {
  it("multiplies (1 − penalty) per raised flag", () => {
    expect(penaltyFactor({})).toBe(1);
    expect(penaltyFactor({ placeholderBn: true })).toBeCloseTo(1 - PENALTIES.placeholderBn, 9);
    expect(penaltyFactor({ placeholderBn: true, duplicateRows: true })).toBeCloseTo(
      (1 - PENALTIES.placeholderBn) * (1 - PENALTIES.duplicateRows),
      9,
    );
    expect(penaltyFactor({ placeholderBn: false })).toBe(1);
  });

  it("evidenceStrength = clamp01(base × penalties), rounded to 3 dp", () => {
    expect(evidenceStrength({ signal: 3, threshold: 3 })).toBe(0.5);
    expect(evidenceStrength({ signal: 6, threshold: 3 })).toBe(0.816);
    expect(evidenceStrength({ margin: 1, flags: { hubTouched: true } })).toBe(
      Math.round(0.8160602794 * (1 - PENALTIES.hubTouched) * 1000) / 1000,
    );
    expect(evidenceStrength({ margin: Infinity })).toBe(1);
    expect(evidenceStrength({ margin: NaN })).toBe(0.5);
  });

  it("never leaves [0, 1]", () => {
    const all = Object.fromEntries(Object.keys(PENALTIES).map((k) => [k, true]));
    const s = evidenceStrength({ margin: 0, flags: all });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(0.5);
    expect(evidenceStrength({ margin: 1e9 })).toBe(1);
  });
});

describe("strength — benign notes", () => {
  it("every pattern lists at least one false-positive note", () => {
    for (const p of PATTERNS) expect(p.falsePositiveNotes.length).toBeGreaterThan(0);
  });

  it("name patterns map to the upstream caveat vocabulary", () => {
    expect(nameFalsePositive("Vancouver Foundation")).toBe("COMMUNITY_FOUNDATION");
    expect(nameFalsePositive("Canada Gives")).toBe("DAF_PLATFORM");
    expect(nameFalsePositive("United Way of Calgary")).toBe("FEDERATED_CHARITY");
    expect(nameFalsePositive("Anglican Diocese of Ottawa")).toBe("DENOMINATIONAL_HIERARCHY");
    expect(nameFalsePositive("Batch Report | Rapport en lots")).toBe("PUBLISHER_AGGREGATED");
    expect(nameFalsePositive("Acme Widgets Inc.")).toBeNull();
    expect(nameFalsePositive(null)).toBeNull();
  });

  it("returns only notes the pattern lists, preferring detector hints, then name, then flags", () => {
    // zombie lists ONE_OFF_CAPITAL / PLACEHOLDER_BN but not DAF_PLATFORM
    expect(benignNoteFor("zombie-recipients", { name: "Canada Gives", flags: { placeholderBn: true } })).toBe(FP.PLACEHOLDER_BN);
    expect(
      benignNoteFor("zombie-recipients", { name: "Acme", flags: { placeholderBn: true }, preferred: ["ONE_OFF_CAPITAL"] }),
    ).toBe(FP.ONE_OFF_CAPITAL);
    // funding-loops: name wins over flags
    expect(benignNoteFor("funding-loops", { name: "Aqueduct Foundation", flags: { hubTouched: true } })).toBe(FP.DAF_PLATFORM);
    expect(benignNoteFor("funding-loops", { name: "Plain Charity", flags: { hubTouched: true } })).toBe(FP.DAF_PLATFORM);
    // pattern-wide caveat only when nothing more specific applies
    expect(benignNoteFor("policy-misalignment", { always: ["KEYWORD_PROXY"] })).toBe(FP.KEYWORD_PROXY);
    expect(benignNoteFor("zombie-recipients", { name: "Acme" })).toBeNull();
    expect(benignNoteFor("no-such-pattern", { name: "Canada Gives" })).toBeNull();
  });

  it("maps severity bands both ways", () => {
    expect(severityToSignalStrength("critical")).toBe("flag");
    expect(severityToSignalStrength("high")).toBe("flag");
    expect(severityToSignalStrength("medium")).toBe("attention");
    expect(severityToSignalStrength("low")).toBe("observation");
    expect(signalStrengthToSeverity("flag")).toBe("high");
    expect(signalStrengthToSeverity("attention")).toBe("medium");
    expect(signalStrengthToSeverity("observation")).toBe("low");
    expect(signalStrengthToSeverity(undefined)).toBe("low");
  });
});
