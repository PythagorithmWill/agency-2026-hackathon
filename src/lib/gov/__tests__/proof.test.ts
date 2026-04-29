import { describe, it, expect } from "vitest";
import { proofTokenCompleteness, validateBrief } from "../validators";
import weBrief from "../../../data/briefs/we-charity-foundation.json";
import sdtcBrief from "../../../data/briefs/sustainable-development-technology-canada.json";
import cfSif from "../../../data/briefs/cf-sif-showcase-1.json";
import type { OutcomeBrief, ProofToken } from "../../types";

describe("Proof token completeness", () => {
  it("rejects null token", () => {
    const r = proofTokenCompleteness(null);
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects token missing the 'observations from public records' disclaimer", () => {
    const bad: ProofToken = {
      ...(weBrief.proofToken as ProofToken),
      disclaimers: ["only this one disclaimer"],
    };
    const r = proofTokenCompleteness(bad);
    expect(r.find((v) => v.detail?.includes("observations"))).toBeTruthy();
  });

  it("rejects token with calibrationCheck != 'passed'", () => {
    const bad = {
      ...(weBrief.proofToken as ProofToken),
      tiers: {
        ...(weBrief.proofToken.tiers as ProofToken["tiers"]),
        output: {
          ...(weBrief.proofToken.tiers.output as ProofToken["tiers"]["output"]),
          calibrationCheck: "failed" as const,
        },
      },
    };
    const r = proofTokenCompleteness(bad);
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects token with quoteWordCountMax >= 15", () => {
    const bad = {
      ...(weBrief.proofToken as ProofToken),
      tiers: {
        ...(weBrief.proofToken.tiers as ProofToken["tiers"]),
        output: {
          ...(weBrief.proofToken.tiers.output as ProofToken["tiers"]["output"]),
          quoteWordCountMax: 17,
        },
      },
    };
    const r = proofTokenCompleteness(bad);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("Brief end-to-end validation — cached briefs must pass clean", () => {
  it("WE Charity Foundation brief passes", () => {
    const r = validateBrief(weBrief as unknown as OutcomeBrief);
    if (!r.passed) console.error("WE violations:", r.violations);
    expect(r.passed).toBe(true);
  });

  it("SDTC brief passes", () => {
    const r = validateBrief(sdtcBrief as unknown as OutcomeBrief);
    if (!r.passed) console.error("SDTC violations:", r.violations);
    expect(r.passed).toBe(true);
  });

  it("Counterfactual SIF showcase brief passes", () => {
    const r = validateBrief(cfSif as unknown as OutcomeBrief);
    if (!r.passed) console.error("CF SIF violations:", r.violations);
    expect(r.passed).toBe(true);
  });
});
