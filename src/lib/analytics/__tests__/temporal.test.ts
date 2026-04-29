import { describe, it, expect } from "vitest";
import { linearRegression, classifyTrend, forecastForward } from "../temporal";

describe("temporal analytics", () => {
  it("linear regression on a perfect line gives R² = 1", () => {
    const r = linearRegression([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]);
    expect(r.slope).toBeCloseTo(10);
    expect(r.intercept).toBeCloseTo(0);
    expect(r.rSquared).toBeCloseTo(1);
  });

  it("classifies a flat series as 'flat'", () => {
    const t = classifyTrend([
      { fy: 2020, total: 100 },
      { fy: 2021, total: 100 },
      { fy: 2022, total: 100 },
      { fy: 2023, total: 100 },
    ]);
    expect(t.trend).toBe("flat");
  });

  it("classifies a clearly growing series as 'growing'", () => {
    const t = classifyTrend([
      { fy: 2019, total: 100 },
      { fy: 2020, total: 200 },
      { fy: 2021, total: 300 },
      { fy: 2022, total: 400 },
      { fy: 2023, total: 500 },
    ]);
    expect(t.trend).toBe("growing");
    expect(t.rSquared).toBeGreaterThan(0.9);
  });

  it("classifies a clearly shrinking series as 'shrinking'", () => {
    const t = classifyTrend([
      { fy: 2019, total: 1000 },
      { fy: 2020, total: 800 },
      { fy: 2021, total: 600 },
      { fy: 2022, total: 400 },
      { fy: 2023, total: 200 },
    ]);
    expect(t.trend).toBe("shrinking");
  });

  it("forecast forward 3 years on a linear input", () => {
    const f = forecastForward(
      [
        { fy: 2019, value: 100 },
        { fy: 2020, value: 200 },
        { fy: 2021, value: 300 },
        { fy: 2022, value: 400 },
        { fy: 2023, value: 500 },
      ],
      3,
    );
    expect(f.forecast).toHaveLength(3);
    expect(f.forecast[0].fy).toBe(2024);
    expect(f.forecast[0].predicted).toBeCloseTo(600, -1);
    expect(f.forecast[2].fy).toBe(2026);
    expect(f.rSquared).toBeGreaterThan(0.95);
  });

  it("forecast bounds widen with each forward year", () => {
    const f = forecastForward(
      [
        { fy: 2019, value: 100 },
        { fy: 2020, value: 220 },
        { fy: 2021, value: 290 },
        { fy: 2022, value: 410 },
        { fy: 2023, value: 480 },
      ],
      3,
    );
    const w0 = f.forecast[0].upperBound - f.forecast[0].lowerBound;
    const w2 = f.forecast[2].upperBound - f.forecast[2].lowerBound;
    expect(w2).toBeGreaterThan(w0);
  });

  it("forecast caps lower bound at 0 (no negative spend)", () => {
    const f = forecastForward(
      [
        { fy: 2019, value: 1000 },
        { fy: 2020, value: 800 },
        { fy: 2021, value: 600 },
        { fy: 2022, value: 400 },
      ],
      5,
    );
    f.forecast.forEach((p) => {
      expect(p.lowerBound).toBeGreaterThanOrEqual(0);
    });
  });
});
