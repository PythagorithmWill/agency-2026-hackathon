import { describe, it, expect } from "vitest";
import { _mapToMatchForTest, _ATTENTION_THRESHOLD_FOR_TEST } from "../funding-loops";

const baseRow = {
  bn: "129253308RR0001",
  legal_name: "EXAMPLE FOUNDATION",
  total_loops: 95,
  loops_2hop: 1,
  loops_3hop: 4,
  loops_4hop: 9,
  loops_5hop: 20,
  loops_6hop: 61,
  loops_7plus: 0,
  max_bottleneck: 100000,
  total_circular_amt: 889416,
  score: 19,
  scored_at: "2026-04-19T20:00:29.182Z",
};

describe("funding-loops detector — mapping", () => {
  it("returns null when score is below the attention threshold", () => {
    const m = _mapToMatchForTest({ ...baseRow, score: 11 });
    expect(m).toBeNull();
  });

  it("returns a match at exactly the attention threshold", () => {
    const m = _mapToMatchForTest({ ...baseRow, score: _ATTENTION_THRESHOLD_FOR_TEST });
    expect(m).not.toBeNull();
    expect(m?.signalStrength).toBe("observation");
  });

  it("scales severity with score: ≥18 flag, 15–17 attention, 12–14 observation", () => {
    expect(_mapToMatchForTest({ ...baseRow, score: 12 })?.signalStrength).toBe("observation");
    expect(_mapToMatchForTest({ ...baseRow, score: 14 })?.signalStrength).toBe("observation");
    expect(_mapToMatchForTest({ ...baseRow, score: 15 })?.signalStrength).toBe("attention");
    expect(_mapToMatchForTest({ ...baseRow, score: 17 })?.signalStrength).toBe("attention");
    expect(_mapToMatchForTest({ ...baseRow, score: 18 })?.signalStrength).toBe("flag");
    expect(_mapToMatchForTest({ ...baseRow, score: 23 })?.signalStrength).toBe("flag");
  });

  it("identifies reciprocal shape when 2-hop dominates", () => {
    const m = _mapToMatchForTest({
      ...baseRow,
      loops_2hop: 50,
      loops_3hop: 1,
      loops_4hop: 0,
      loops_5hop: 0,
      loops_6hop: 0,
      loops_7plus: 0,
    });
    expect(m?.evidence.find((e) => e.field === "loop_shape")?.value).toMatch(/reciprocal/);
  });

  it("identifies triangular shape when 3-hop dominates", () => {
    const m = _mapToMatchForTest({
      ...baseRow,
      loops_2hop: 0,
      loops_3hop: 30,
      loops_4hop: 1,
      loops_5hop: 0,
      loops_6hop: 0,
      loops_7plus: 0,
    });
    expect(m?.evidence.find((e) => e.field === "loop_shape")?.value).toMatch(/triangular/);
  });

  it("identifies chain shape when long-tail (4+ hops) dominates", () => {
    const m = _mapToMatchForTest(baseRow); // 9+20+61+0 = 90 vs 1 vs 4
    expect(m?.evidence.find((e) => e.field === "loop_shape")?.value).toMatch(/chain/);
  });

  it("emits calibrated language and TRACE attribution in summary", () => {
    const m = _mapToMatchForTest(baseRow);
    expect(m?.calibratedSummary.toLowerCase()).toMatch(/the dataset shows/);
    expect(m?.calibratedSummary).toMatch(/Alberta TRACE methodology/);
    expect(m?.calibratedSummary.toLowerCase()).not.toMatch(/fraud|should have|clearly shows|caused/);
  });

  it("evidence array carries source citations to cra.loop_universe", () => {
    const m = _mapToMatchForTest(baseRow);
    expect(m?.evidence.every((e) => e.source === "cra.loop_universe")).toBe(true);
    expect(m?.evidence.length).toBeGreaterThanOrEqual(3);
  });
});
