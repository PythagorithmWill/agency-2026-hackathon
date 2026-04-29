import { describe, it, expect } from "vitest";
import { _mapZombieForTest, _ZOMBIE_FLOORS_FOR_TEST } from "../zombie-recipients";

const sevenYearsAgo = new Date(
  Date.now() - 7 * 365.25 * 24 * 60 * 60 * 1000,
).toISOString();
const fourYearsAgo = new Date(
  Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000,
).toISOString();
const threeYearsAgo = new Date(
  Date.now() - 3 * 365.25 * 24 * 60 * 60 * 1000,
).toISOString();

const baseRow = {
  recipient_legal_name: "OLD ORG",
  recipient_business_number: "123456789",
  recipient_type: "Non-profit",
  recipient_province: "ON",
  recipient_city: "Ottawa",
  grant_count: 4,
  total_value: 1_500_000,
  first_grant: "2015-01-01",
  last_grant: sevenYearsAgo,
  dept_count: 2,
};

describe("zombie-recipients — mapping", () => {
  it("returns null below the total-funding floor", () => {
    const m = _mapZombieForTest({ ...baseRow, total_value: 100_000 });
    expect(m).toBeNull();
  });

  it("returns null when last_grant is missing", () => {
    const m = _mapZombieForTest({ ...baseRow, last_grant: null });
    expect(m).toBeNull();
  });

  it("scales severity by years of silence: ≥6 flag, ≥4 attention, otherwise observation", () => {
    expect(
      _mapZombieForTest({ ...baseRow, last_grant: threeYearsAgo })?.signalStrength,
    ).toBe("observation");
    expect(
      _mapZombieForTest({ ...baseRow, last_grant: fourYearsAgo })?.signalStrength,
    ).toBe("attention");
    expect(
      _mapZombieForTest({ ...baseRow, last_grant: sevenYearsAgo })?.signalStrength,
    ).toBe("flag");
  });

  it("emits calibrated language with no causal claim", () => {
    const m = _mapZombieForTest(baseRow);
    expect(m?.calibratedSummary.toLowerCase()).toMatch(/the dataset shows/);
    expect(m?.calibratedSummary.toLowerCase()).toMatch(/years of subsequent silence/);
    expect(m?.calibratedSummary.toLowerCase()).not.toMatch(
      /fraud|should have|caused|clearly shows/,
    );
  });

  it("includes BN in the summary when available", () => {
    const m = _mapZombieForTest(baseRow);
    expect(m?.calibratedSummary).toMatch(/BN 123456789/);
  });

  it("falls back to legal_name as subject id when BN missing", () => {
    const m = _mapZombieForTest({ ...baseRow, recipient_business_number: null });
    expect(m?.subject.id).toBe("OLD ORG");
  });

  it("evidence array cites fed.grants_contributions", () => {
    const m = _mapZombieForTest(baseRow);
    expect(m?.evidence.every((e) => e.source === "fed.grants_contributions")).toBe(true);
    expect(m?.evidence.find((e) => e.field === "last_grant")).toBeDefined();
  });

  it("exposes the configured floor constants", () => {
    expect(_ZOMBIE_FLOORS_FOR_TEST.TOTAL_FLOOR).toBe(500_000);
    expect(_ZOMBIE_FLOORS_FOR_TEST.SILENCE_MONTHS).toBe(36);
  });
});
