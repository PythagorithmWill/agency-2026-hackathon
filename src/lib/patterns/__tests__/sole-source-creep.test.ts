import { describe, it, expect } from "vitest";
import { _mapForTest, _CREEP_FLOORS_FOR_TEST, creepRatio } from "../sole-source-creep";

// agreement_value is CUMULATIVE (F-3): final_value is the latest
// amendment row's restated total, not original + deltas.
const baseRow = {
  ref_number: "ABC-123",
  recipient_legal_name: "EXAMPLE INC.",
  owner_org_title: "Department of Example",
  original_value: 200_000,
  final_value: 1_000_000, // ratio 5x
  amendment_count: 3,
  first_amendment: "2020-04-01",
  last_amendment: "2024-09-15",
};

describe("sole-source-creep — cumulative amendment semantics", () => {
  it("001-2020-2021-Q1-00006: 20.54M → 36.24M → 36.24M → 36.24M is 1.76×, not a match", () => {
    // Live chain verified 2026-09-24. Under the old delta model this read
    // as 20.54M + 3 × 36.24M = 129.3M (6.29×) and was surfaced as creep.
    expect(creepRatio(20_540_000, 36_240_000)).toBeCloseTo(1.76, 2);
    const m = _mapForTest({
      ...baseRow,
      ref_number: "001-2020-2021-Q1-00006",
      original_value: 20_540_000,
      final_value: 36_240_000,
      amendment_count: 3,
    });
    expect(m).toBeNull();
  });

  it("returns null when growth ratio is below the floor", () => {
    const m = _mapForTest({ ...baseRow, final_value: 300_000 }); // ratio 1.5
    expect(m).toBeNull();
  });

  it("returns a match when ratio meets the floor exactly", () => {
    const m = _mapForTest({ ...baseRow, original_value: 200_000, final_value: 600_000 }); // 3.0
    expect(m).not.toBeNull();
    expect(m?.signalStrength).toBe("observation");
    expect(m?.evidence.find((e) => e.field === "final_value")?.value).toBe(600_000);
  });

  it("scales severity: ≥10× flag, ≥5× attention, otherwise observation", () => {
    const at = (final: number) =>
      _mapForTest({ ...baseRow, original_value: 100_000, final_value: final })?.signalStrength;
    expect(at(300_000)).toBe("observation"); // 3x
    expect(at(400_000)).toBe("observation"); // 4x
    expect(at(500_000)).toBe("attention"); // 5x — boundary
    expect(at(600_000)).toBe("attention"); // 6x
    expect(at(1_100_000)).toBe("flag"); // 11x
  });

  it("rejects when original_value is zero", () => {
    expect(_mapForTest({ ...baseRow, original_value: 0 })).toBeNull();
    expect(creepRatio(0, 1_000_000)).toBe(0);
  });

  it("emits calibrated language with the growth ratio in the summary", () => {
    const m = _mapForTest(baseRow);
    expect(m?.calibratedSummary.toLowerCase()).toMatch(/the dataset shows/);
    expect(m?.calibratedSummary).toMatch(/5\.0× expansion/);
    expect(m?.calibratedSummary.toLowerCase()).not.toMatch(/fraud|should have|caused/);
  });

  it("evidence cites fed.grants_contributions, includes the ratio, and coerces pg Date values", () => {
    const m = _mapForTest({ ...baseRow, last_amendment: new Date("2024-09-15T00:00:00Z") });
    expect(m?.evidence.every((e) => e.source === "fed.grants_contributions")).toBe(true);
    expect(m?.evidence.find((e) => e.field === "growth_ratio")?.value).toBe("5.00");
    expect(m?.evidence.find((e) => e.field === "last_amendment")?.value).toBe("2024-09-15T00:00:00.000Z");
  });

  it("exposes the configured floor constants", () => {
    expect(_CREEP_FLOORS_FOR_TEST.ORIGINAL_VALUE_FLOOR).toBe(100_000);
    expect(_CREEP_FLOORS_FOR_TEST.GROWTH_RATIO_FLOOR).toBe(3.0);
  });
});
