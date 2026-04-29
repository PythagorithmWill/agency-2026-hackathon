import { describe, it, expect } from "vitest";
import { _mapForTest, _CREEP_FLOORS_FOR_TEST } from "../sole-source-creep";

const baseRow = {
  ref_number: "ABC-123",
  recipient_legal_name: "EXAMPLE INC.",
  owner_org_title: "Department of Example",
  original_value: 200_000,
  amendment_total: 800_000, // → final 1M, ratio 5x
  amendment_count: 3,
  first_amendment: "2020-04-01",
  last_amendment: "2024-09-15",
};

describe("sole-source-creep — mapping", () => {
  it("returns null when growth ratio is below the floor", () => {
    const m = _mapForTest({ ...baseRow, amendment_total: 100_000 }); // ratio 1.5
    expect(m).toBeNull();
  });

  it("returns a match when ratio meets the floor exactly", () => {
    const m = _mapForTest({
      ...baseRow,
      original_value: 200_000,
      amendment_total: 400_000, // final 600K, ratio 3.0
    });
    expect(m).not.toBeNull();
    expect(m?.signalStrength).toBe("observation");
  });

  it("scales severity: ≥10× flag, ≥5× attention, otherwise observation", () => {
    expect(
      _mapForTest({ ...baseRow, original_value: 100_000, amendment_total: 200_000 })
        ?.signalStrength,
    ).toBe("observation"); // 3x
    expect(
      _mapForTest({ ...baseRow, original_value: 100_000, amendment_total: 300_000 })
        ?.signalStrength,
    ).toBe("observation"); // 4x
    expect(
      _mapForTest({ ...baseRow, original_value: 100_000, amendment_total: 400_000 })
        ?.signalStrength,
    ).toBe("attention"); // 5x — boundary
    expect(
      _mapForTest({ ...baseRow, original_value: 100_000, amendment_total: 500_000 })
        ?.signalStrength,
    ).toBe("attention"); // 6x
    expect(
      _mapForTest({ ...baseRow, original_value: 100_000, amendment_total: 1_000_000 })
        ?.signalStrength,
    ).toBe("flag"); // 11x
  });

  it("rejects when original_value is zero", () => {
    const m = _mapForTest({ ...baseRow, original_value: 0 });
    expect(m).toBeNull();
  });

  it("emits calibrated language with the growth ratio in the summary", () => {
    const m = _mapForTest(baseRow);
    expect(m?.calibratedSummary.toLowerCase()).toMatch(/the dataset shows/);
    expect(m?.calibratedSummary).toMatch(/× expansion/);
    expect(m?.calibratedSummary.toLowerCase()).not.toMatch(/fraud|should have|caused/);
  });

  it("evidence cites fed.grants_contributions and includes the ratio", () => {
    const m = _mapForTest(baseRow);
    expect(m?.evidence.every((e) => e.source === "fed.grants_contributions")).toBe(true);
    expect(m?.evidence.find((e) => e.field === "growth_ratio")?.value).toBeDefined();
  });

  it("exposes the configured floor constants", () => {
    expect(_CREEP_FLOORS_FOR_TEST.ORIGINAL_VALUE_FLOOR).toBe(100_000);
    expect(_CREEP_FLOORS_FOR_TEST.GROWTH_RATIO_FLOOR).toBe(3.0);
  });
});
