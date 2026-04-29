import { describe, it, expect } from "vitest";
import { computeConcentration, describeConcentration } from "../concentration";

describe("concentration analytics", () => {
  it("returns zeros on empty input", () => {
    const r = computeConcentration([]);
    expect(r.totalSpend).toBe(0);
    expect(r.hhi).toBe(0);
    expect(r.recipientCount).toBe(0);
  });

  it("HHI of 10000 for a monopoly", () => {
    const r = computeConcentration([
      { recipient: "Sole Inc", bn: null, total: 1_000_000, agreementCount: 5 },
    ]);
    expect(r.hhi).toBeCloseTo(10000, 0);
  });

  it("HHI of 5000 for two equal players", () => {
    const r = computeConcentration([
      { recipient: "A", bn: null, total: 100, agreementCount: 1 },
      { recipient: "B", bn: null, total: 100, agreementCount: 1 },
    ]);
    expect(r.hhi).toBeCloseTo(5000, 0);
  });

  it("Gini = 0 for perfect equality", () => {
    const r = computeConcentration(
      Array.from({ length: 10 }, (_, i) => ({
        recipient: `R${i}`,
        bn: null,
        total: 100,
        agreementCount: 1,
      })),
    );
    expect(r.gini).toBeCloseTo(0, 1);
  });

  it("Gini approaches 1 as concentration extreme", () => {
    const r = computeConcentration([
      ...Array.from({ length: 99 }, (_, i) => ({
        recipient: `Small${i}`,
        bn: null,
        total: 1,
        agreementCount: 1,
      })),
      { recipient: "Mega", bn: null, total: 1_000_000, agreementCount: 1 },
    ]);
    expect(r.gini).toBeGreaterThan(0.85);
  });

  it("top10 returns at most 10, sorted descending", () => {
    const r = computeConcentration(
      Array.from({ length: 25 }, (_, i) => ({
        recipient: `R${i}`,
        bn: null,
        total: 100 - i,
        agreementCount: 1,
      })),
    );
    expect(r.top10).toHaveLength(10);
    expect(r.top10[0].total).toBeGreaterThan(r.top10[9].total);
  });

  it("describeConcentration returns calibrated text without forbidden phrases", () => {
    const r = computeConcentration([
      { recipient: "A", bn: null, total: 1_000_000, agreementCount: 3 },
      { recipient: "B", bn: null, total: 500_000, agreementCount: 2 },
      { recipient: "C", bn: null, total: 100_000, agreementCount: 1 },
    ]);
    const desc = describeConcentration(r);
    // Calibrated phrases — must include "the dataset shows"
    expect(desc.toLowerCase()).toMatch(/the dataset shows/);
    // No forbidden phrases
    expect(desc.toLowerCase()).not.toMatch(/fraud|should have|clearly shows/);
  });

  it("decileBreakdown sums to 1.0", () => {
    const r = computeConcentration(
      Array.from({ length: 100 }, (_, i) => ({
        recipient: `R${i}`,
        bn: null,
        total: i + 1,
        agreementCount: 1,
      })),
    );
    const sum = r.decileBreakdown.reduce((s, d) => s + d.share, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
