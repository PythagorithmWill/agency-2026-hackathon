import { describe, it, expect } from "vitest";
import { calibrationSweep } from "../validators";

/**
 * 18 calibration test cases — 10 must REJECT (known leaks), 8 must ACCEPT
 * (calibrated phrasings the validator must NOT false-positive on).
 *
 * Per AUTONOMOUS-EXECUTION.md gate 4 — all 18 must pass.
 */

describe("PYTH-GOV calibration sweep — 10 reject cases", () => {
  it("rejects 'the government failed to' as failure-attribution", () => {
    const r = calibrationSweep("The government failed to deliver on the program.");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].type).toBe("CALIBRATION_LEAK");
  });

  it("rejects 'evidence of fraud'", () => {
    const r = calibrationSweep("The dataset shows clear evidence of fraud.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'should have stated' (counterfactual prescriptive)", () => {
    const r = calibrationSweep("This grant should have stated its outcomes.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'in exchange for'", () => {
    const r = calibrationSweep("The donations were in exchange for grants.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'because of the grant'", () => {
    const r = calibrationSweep("The lobbying activity intensified because of the grant award.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'caused the contract'", () => {
    const r = calibrationSweep("The political donation caused the contract to be awarded.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'this raises serious questions'", () => {
    const r = calibrationSweep("This raises serious questions about oversight.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'allegedly' as unsourced hedge", () => {
    const r = calibrationSweep("The recipient allegedly diverted the funds.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'clearly shows misconduct'", () => {
    const r = calibrationSweep("The audit clearly shows misconduct.");
    expect(r.length).toBeGreaterThan(0);
  });

  it("rejects 'massive amounts of public money'", () => {
    const r = calibrationSweep("They received massive amounts of public money.");
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("PYTH-GOV calibration sweep — 8 accept cases (must NOT false-positive)", () => {
  it("accepts 'the dataset shows…' (the canonical calibrated phrase)", () => {
    const r = calibrationSweep(
      "The dataset shows federal contributions totalling $134M between fiscal 2017 and fiscal 2024.",
    );
    expect(r).toEqual([]);
  });

  it("accepts 'pattern consistent with…' framing", () => {
    const r = calibrationSweep(
      "Pattern consistent with sole-source amendment growth across the agreement chain.",
    );
    expect(r).toEqual([]);
  });

  it("accepts 'records indicate' attribution", () => {
    const r = calibrationSweep(
      "Records indicate the contribution agreement was terminated on July 3, 2020.",
    );
    expect(r).toEqual([]);
  });

  it("accepts 'comparable filings typically state…' (Counterfactual phrasing)", () => {
    const r = calibrationSweep(
      "Comparable filings typically state the program stream and the recipient's expected outcomes.",
    );
    expect(r).toEqual([]);
  });

  it("accepts 'lobbying registration filed 47 days before grant' (temporal, not causal)", () => {
    const r = calibrationSweep(
      "Lobbying registration was filed 47 days before the grant award date.",
    );
    expect(r).toEqual([]);
  });

  it("accepts a numeric score sentence", () => {
    const r = calibrationSweep("Score: 28 of 30 indicators triggered (CRITICAL).");
    expect(r).toEqual([]);
  });

  it("accepts 'public records do not contain…' (calibrated absence claim)", () => {
    const r = calibrationSweep(
      "Public records do not contain a final disposition statement for this contribution.",
    );
    expect(r).toEqual([]);
  });

  it("accepts 'documents reference…' (calibrated source pointer)", () => {
    const r = calibrationSweep(
      "Documents reference an Auditor General performance audit published in June 2024.",
    );
    expect(r).toEqual([]);
  });
});
