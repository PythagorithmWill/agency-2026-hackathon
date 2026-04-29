import { describe, it, expect } from "vitest";
import { buildTrajectory, jaccard } from "../amendments";

describe("amendment trajectory analytics", () => {
  it("returns empty trajectory on empty input", () => {
    const t = buildTrajectory("ref-1", []);
    expect(t.amendments).toEqual([]);
    expect(t.totalGrowth).toBe(0);
    expect(t.flags).toHaveLength(0);
  });

  it("computes deltas between amendments", () => {
    const t = buildTrajectory("ref-1", [
      { amendmentNumber: 0, date: "2020-01-01", agreementValue: 100, description: null },
      { amendmentNumber: 1, date: "2020-06-01", agreementValue: 150, description: null },
      { amendmentNumber: 2, date: "2021-01-01", agreementValue: 200, description: null },
    ]);
    expect(t.amendments[0].delta).toBe(0);
    expect(t.amendments[1].delta).toBe(50);
    expect(t.amendments[2].delta).toBe(50);
    expect(t.totalGrowth).toBe(100);
    expect(t.totalGrowthPercent).toBeCloseTo(1);
  });

  it("flags amendment_growth when growth exceeds 200%", () => {
    const t = buildTrajectory(
      "ref-2",
      [
        { amendmentNumber: 0, date: "2020-01-01", agreementValue: 1_000_000, description: "Initial scope" },
        { amendmentNumber: 1, date: "2021-01-01", agreementValue: 4_000_000, description: "Initial scope" },
      ],
      "Acme Corp",
    );
    const growthFlag = t.flags.find((f) => f.flagType === "amendment_growth");
    expect(growthFlag).toBeDefined();
    expect(growthFlag?.severity).toBe("attention"); // 300% growth → attention
  });

  it("does NOT flag growth when under 200%", () => {
    const t = buildTrajectory("ref-3", [
      { amendmentNumber: 0, date: "2020-01-01", agreementValue: 100, description: null },
      { amendmentNumber: 1, date: "2021-01-01", agreementValue: 150, description: null },
    ]);
    expect(t.flags).toHaveLength(0);
  });

  it("flags amendment_purpose_drift when keyword overlap is low", () => {
    const t = buildTrajectory(
      "ref-4",
      [
        { amendmentNumber: 0, date: "2019-01-01", agreementValue: 100, description: "Construction of community broadband infrastructure across northern Manitoba" },
        { amendmentNumber: 1, date: "2020-01-01", agreementValue: 110, description: "Same scope" },
        { amendmentNumber: 2, date: "2022-01-01", agreementValue: 120, description: "Operational support for unrelated downtown commercial real estate development" },
      ],
    );
    const driftFlag = t.flags.find((f) => f.flagType === "amendment_purpose_drift");
    expect(driftFlag).toBeDefined();
  });

  it("uses calibrated language in summaries (no forbidden phrases)", () => {
    const t = buildTrajectory(
      "ref-5",
      [
        { amendmentNumber: 0, date: "2020-01-01", agreementValue: 1_000_000, description: null },
        { amendmentNumber: 1, date: "2021-01-01", agreementValue: 5_000_000, description: null },
      ],
    );
    const flag = t.flags[0];
    expect(flag.calibratedSummary.toLowerCase()).not.toMatch(/fraud|should have|clearly shows|caused/);
    expect(flag.calibratedSummary.toLowerCase()).toMatch(/the dataset shows/);
  });
});

describe("Jaccard similarity helper", () => {
  it("returns 1 for identical strings", () => {
    expect(jaccard("rural broadband infrastructure", "rural broadband infrastructure")).toBeCloseTo(1);
  });
  it("returns 0 for fully disjoint strings", () => {
    expect(jaccard("solar panels", "downtown construction")).toBeCloseTo(0);
  });
  it("returns intermediate for partial overlap", () => {
    const sim = jaccard(
      "rural broadband expansion northern community",
      "rural broadband upgrade municipal community",
    );
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(1);
  });
});
