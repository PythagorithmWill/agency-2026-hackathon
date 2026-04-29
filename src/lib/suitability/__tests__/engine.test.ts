import { describe, it, expect } from "vitest";
import {
  scoreSubmission,
  scoreUniqueness,
  scoreDuplicationRisk,
  scoreRecipientConcentration,
  scoreLanguageCalibration,
  computeHHI,
} from "../engine";
import type {
  ComparableRecord,
  AwardeeConcentration,
  CalibrationFlag,
  DraftSubmission,
} from "../../types";

const draft: DraftSubmission = {
  workingTitle: "Northern community broadband expansion",
  draftText: "Funding to expand fixed-wireless broadband across northern communities.",
  awardingDepartment: "Innovation, Science and Economic Development Canada",
  anticipatedAmount: 4_200_000,
  anticipatedFiscalYear: 2026,
};

const comparable = (overrides: Partial<ComparableRecord>): ComparableRecord => ({
  recordId: "r-1",
  sourceDataset: "fed",
  recipientLegalName: "Acme Telecom",
  recipientBn: "123456789",
  recipientProvince: "ON",
  awardingDept: draft.awardingDepartment,
  programCode: "USE",
  fiscalYear: 2026,
  agreementValue: 4_000_000,
  description: "Fixed wireless broadband expansion to remote communities.",
  similarity: 0.5,
  retrievalReason: "hybrid",
  ...overrides,
});

const conc = (hhi: number): AwardeeConcentration => ({
  topRecipients: [],
  hhi,
  observation: `The dataset shows recipient HHI ${hhi.toFixed(2)} across the comparable pool.`,
  citations: [],
});

describe("suitability engine — uniqueness", () => {
  it("returns 10 when no comparables exist", () => {
    expect(scoreUniqueness([])).toBe(10);
  });
  it("falls when a high-similarity match exists", () => {
    const u = scoreUniqueness([comparable({ similarity: 0.92 })]);
    expect(u).toBeLessThanOrEqual(1);
  });
  it("stays high when only weak matches exist", () => {
    const u = scoreUniqueness([
      comparable({ similarity: 0.4 }),
      comparable({ similarity: 0.3 }),
    ]);
    expect(u).toBeGreaterThanOrEqual(5);
  });
});

describe("suitability engine — duplication risk", () => {
  it("returns 0 when no records cross the 0.75 threshold", () => {
    const r = scoreDuplicationRisk(
      [comparable({ similarity: 0.6 }), comparable({ similarity: 0.5 })],
      draft,
    );
    expect(r).toBe(0);
  });
  it("escalates with the count of high-similarity adjacent-fy records", () => {
    const lots = Array.from({ length: 12 }, (_, i) =>
      comparable({ similarity: 0.85, recordId: `r-${i}` }),
    );
    const r = scoreDuplicationRisk(lots, draft);
    expect(r).toBe(10);
  });
  it("respects the same-department gate", () => {
    const otherDept = comparable({
      similarity: 0.9,
      awardingDept: "Some Other Department",
    });
    expect(scoreDuplicationRisk([otherDept], draft)).toBe(0);
  });
});

describe("suitability engine — recipient concentration", () => {
  it("scores low for diverse recipient pools (HHI < 0.15)", () => {
    expect(scoreRecipientConcentration(conc(0.05))).toBeLessThanOrEqual(3);
  });
  it("scores high for concentrated pools (HHI >= 0.25)", () => {
    expect(scoreRecipientConcentration(conc(0.4))).toBeGreaterThanOrEqual(7);
  });
});

describe("suitability engine — language calibration", () => {
  it("returns 10 with no flags", () => {
    expect(scoreLanguageCalibration([])).toBe(10);
  });
  it("subtracts one per flag", () => {
    const flags: CalibrationFlag[] = [
      { type: "CALIBRATION_LEAK", start: 0, end: 5, match: "fraud" },
      { type: "CALIBRATION_LEAK", start: 6, end: 12, match: "should" },
    ];
    expect(scoreLanguageCalibration(flags)).toBe(8);
  });
  it("floors at zero", () => {
    const flags: CalibrationFlag[] = Array.from({ length: 20 }, (_, i) => ({
      type: "CALIBRATION_LEAK",
      start: i,
      end: i + 1,
      match: "x",
    }));
    expect(scoreLanguageCalibration(flags)).toBe(0);
  });
});

describe("suitability engine — composite + verdict", () => {
  it("PROCEEDs on a clean low-similarity diverse-pool draft", () => {
    const result = scoreSubmission({
      draft,
      comparables: [comparable({ similarity: 0.35 })],
      concentration: conc(0.08),
      flags: [],
    });
    expect(result.composite).toBeGreaterThanOrEqual(25);
    expect(result.verdict).toBe("PROCEED");
  });

  it("DECLINEs on highly-duplicative drafts with calibration leaks", () => {
    const lots = Array.from({ length: 12 }, (_, i) =>
      comparable({ similarity: 0.92, recordId: `r-${i}` }),
    );
    const flags: CalibrationFlag[] = [
      { type: "CALIBRATION_LEAK", start: 0, end: 5, match: "fraud" },
      { type: "CALIBRATION_LEAK", start: 6, end: 12, match: "should" },
      { type: "CALIBRATION_LEAK", start: 13, end: 19, match: "caused" },
    ];
    const result = scoreSubmission({
      draft,
      comparables: lots,
      concentration: conc(0.5),
      flags,
    });
    expect(result.composite).toBeLessThan(15);
    expect(result.verdict).toBe("DECLINE AS DUPLICATIVE");
  });

  it("CONSOLIDATEs on the middle ground", () => {
    const result = scoreSubmission({
      draft,
      comparables: [
        comparable({ similarity: 0.78 }),
        comparable({ similarity: 0.72 }),
        comparable({ similarity: 0.65 }),
      ],
      concentration: conc(0.18),
      flags: [],
    });
    expect(result.verdict).toBe("CONSOLIDATE");
  });
});

describe("HHI helper", () => {
  it("returns 0 on empty input", () => {
    expect(computeHHI([])).toBe(0);
  });
  it("returns 1 for a monopoly", () => {
    expect(computeHHI([{ totalAwarded: 100 }])).toBe(1);
  });
  it("returns ~0.25 for two equal players", () => {
    expect(computeHHI([{ totalAwarded: 50 }, { totalAwarded: 50 }])).toBeCloseTo(0.5, 2);
  });
  it("scales correctly across a fragmented pool", () => {
    const four = computeHHI(Array.from({ length: 4 }, () => ({ totalAwarded: 25 })));
    expect(four).toBeCloseTo(0.25, 2);
  });
});
