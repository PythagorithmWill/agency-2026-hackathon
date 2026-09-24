import { describe, it, expect } from "vitest";
import { _mapZombieForTest } from "../zombie-recipients";
import { _mapVendorForTest, _VENDOR_FLOORS_FOR_TEST } from "../vendor-concentration";
import { _mapForTest as mapCreep } from "../sole-source-creep";
import { FP } from "../false-positives";

/**
 * Relative thresholds + rolling windows (methodology v2). The SQL applies
 * the p90 filter; the mapping layer must (a) anchor time on the corpus
 * as-of date, (b) surface the peer threshold as evidence, and (c) let
 * the margin over the WEAKER of the two thresholds drive strength.
 */
describe("zombie-recipients — rolling window anchored on corpus as-of", () => {
  const base = {
    recipient_legal_name: "OLD ORG",
    recipient_business_number: "123456789",
    grant_count: 4,
    total_value: 1_500_000,
    first_grant: "2015-01-01",
    dept_count: 2,
    primary_department: "Dept A",
    primary_dept_total: 1_500_000,
    dept_p90: 1_000_000,
    dept_peer_count: 400,
  };

  it("measures silence from corpus_as_of, not the wall clock", () => {
    // 2 years before the as-of date: inside the 36-month window → no match,
    // even though it is many years before today.
    expect(_mapZombieForTest({ ...base, last_grant: "2012-01-01", corpus_as_of: "2014-01-01" })).toBeNull();
    // 5 years before as-of → match, signal ≈ 5.0 years
    const m = _mapZombieForTest({ ...base, last_grant: "2009-01-01", corpus_as_of: "2014-01-01" })!;
    expect(m).not.toBeNull();
    expect(m.signal).toBeCloseTo(5.0, 1);
    expect(m.severity).toBe("medium");
    expect(m.evidence.find((e) => e.field === "corpus_as_of")?.value).toBe("2014-01-01");
    expect(m.evidence.find((e) => e.field === "dept_p90_threshold")?.value).toBe(1_000_000);
    expect(m.department).toBe("Dept A");
    expect(m.fiscalYear).toBe(2009); // Jan → same year (Apr–Mar labelled by end year)
  });

  it("strength grows with the margin over the peer threshold and is discounted for placeholder BNs", () => {
    const at = _mapZombieForTest({ ...base, last_grant: "2005-01-01", corpus_as_of: "2014-01-01", primary_dept_total: 1_000_000 })!;
    const far = _mapZombieForTest({ ...base, last_grant: "2005-01-01", corpus_as_of: "2014-01-01", primary_dept_total: 5_000_000 })!;
    expect(far.evidenceStrength).toBeGreaterThan(at.evidenceStrength);
    const placeholder = _mapZombieForTest({
      ...base, last_grant: "2005-01-01", corpus_as_of: "2014-01-01", primary_dept_total: 5_000_000,
      recipient_business_number: "000000000",
    })!;
    expect(placeholder.subject.id).toBe("OLD ORG");
    expect(placeholder.evidenceStrength).toBeLessThan(far.evidenceStrength);
    expect(placeholder.benignNote).toBe(FP.PLACEHOLDER_BN);
    const oneOff = _mapZombieForTest({ ...base, grant_count: 1, last_grant: "2005-01-01", corpus_as_of: "2014-01-01" })!;
    expect(oneOff.benignNote).toBe(FP.ONE_OFF_CAPITAL);
  });
});

describe("vendor-concentration — per-program HHI over a rolling window", () => {
  const base = {
    department: "Dept A",
    program: "Program X",
    prog_total: 50_000_000,
    recipient_count: 3,
    hhi: 6000,
    dept_p90: 4000,
    dept_peer_count: 40,
    corpus_as_of: "2026-05-28",
    top1_name: "Big Vendor Inc.",
    top1_value: 38_000_000,
    top2_name: "Other",
    top2_value: 10_000_000,
    top3_name: "Third",
    top3_value: 2_000_000,
  };

  it("subject is the program, department is a dimension, window ends at as-of", () => {
    const m = _mapVendorForTest(base)!;
    expect(m.subject).toEqual({ type: "program", id: "Program X", canonicalName: "Program X" });
    expect(m.department).toBe("Dept A");
    expect(m.fiscalYear).toBe(2027); // May 2026 → FY2027
    expect(m.severity).toBe("high");
    expect(m.signal).toBe(6000);
    expect(m.evidence.find((e) => e.field === "window")?.value).toBe(`${_VENDOR_FLOORS_FOR_TEST.WINDOW_MONTHS} months to 2026-05-28`);
    expect(m.evidence.find((e) => e.field === "dept_p90_hhi")?.value).toBe(4000);
  });

  it("uses the weaker of the absolute and relative margins", () => {
    // HHI 6000 is 3× the 1500 floor but only 1.5× the p90 → margin 0.5 governs
    const m = _mapVendorForTest(base)!;
    const expectedBase = 0.5 + 0.5 * (1 - Math.exp(-0.5));
    expect(m.evidenceStrength).toBeCloseTo(Math.round(expectedBase * 1000) / 1000, 3);
  });

  it("single-recipient programs are discounted and get the structural note", () => {
    const m = _mapVendorForTest({ ...base, recipient_count: 1, hhi: 10000, top2_name: null, top3_name: null })!;
    expect(m.severity).toBe("critical");
    expect(m.benignNote).toBe(FP.SINGLE_RECIPIENT_PROGRAM);
    const three = _mapVendorForTest({ ...base, hhi: 10000 })!;
    expect(m.evidenceStrength).toBeLessThan(three.evidenceStrength);
  });

  it("drops rows under the absolute HHI floor regardless of percentile", () => {
    expect(_mapVendorForTest({ ...base, hhi: 1200, dept_p90: 900 })).toBeNull();
  });
});

describe("sole-source-creep — per-program percentile evidence", () => {
  it("exposes the program p90 and discounts F-2 / F-4 chains", () => {
    const row = {
      ref_number: "R1", recipient_legal_name: "Vendor", recipient_business_number: "123456789RC0001",
      owner_org_title: "Dept", prog_name_en: "Prog",
      original_value: 100_000, final_value: 600_000, amendment_count: 2,
      prog_p90: 4.0, prog_peer_count: 120,
    };
    const clean = mapCreep(row)!;
    expect(clean.signal).toBe(6);
    expect(clean.evidence.find((e) => e.field === "program_p90_ratio")?.value).toBe(4);
    expect(clean.benignNote).toBeNull();
    const dirty = mapCreep({ ...row, has_duplicate: true, has_negative: true })!;
    expect(dirty.evidenceStrength).toBeLessThan(clean.evidenceStrength);
    expect(dirty.benignNote).toBe(FP.DUPLICATE_ROWS);
  });
});
