import { describe, expect, it } from "vitest";
import {
  fiscalYearOf, fsaOf, nameKey, normBn, normFiscalYear, normName, normPostal, nz,
  parseDateLoose, parseIntLoose, parseMoney, parseTextArray,
} from "../normalize";

describe("normName / nameKey", () => {
  it("uppercases, trims and collapses whitespace", () => {
    expect(normName("  Simzer   Design\tInc. ")).toBe("SIMZER DESIGN INC.");
    expect(normName(null)).toBe("");
  });
  it("nameKey strips punctuation and corporate suffixes", () => {
    expect(nameKey("Acme, Inc.")).toBe("ACME");
    expect(nameKey("The Right Door Consulting & Solutions Inc.")).toBe("RIGHT DOOR CONSULTING SOLUTIONS");
    expect(nameKey("Gestion FNX Ltée")).toBe("GESTION FNX LTÉE");
  });
});

describe("normPostal / fsaOf", () => {
  it("normalises Canadian postal codes", () => {
    expect(normPostal("k2k 3g4")).toBe("K2K3G4");
    expect(normPostal("H1J2V1")).toBe("H1J2V1");
    expect(normPostal("12345")).toBe("");
    expect(normPostal("")).toBe("");
    expect(fsaOf("K1A 0B1")).toBe("K1A");
  });
});

describe("parseMoney", () => {
  it("handles Elections Canada padded amounts and dollar signs", () => {
    expect(parseMoney("         2500.00")).toBe(2500);
    expect(parseMoney("             .00")).toBe(0);
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("(123.45)")).toBe(-123.45);
    expect(parseMoney("-42")).toBe(-42);
    expect(parseMoney("1234,56")).toBe(1234.56);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("n/a")).toBeNull();
  });
});

describe("parseIntLoose", () => {
  it("parses integers and rejects junk", () => {
    expect(parseIntLoose(" 12 ")).toBe(12);
    expect(parseIntLoose("12.5")).toBeNull();
    expect(parseIntLoose("")).toBeNull();
  });
});

describe("parseDateLoose / fiscalYearOf / normFiscalYear", () => {
  it("accepts ISO, compact and DD/MM/YYYY forms and rejects impossible dates", () => {
    expect(parseDateLoose("2020-02-26")).toBe("2020-02-26");
    expect(parseDateLoose("2020/2/6")).toBe("2020-02-06");
    expect(parseDateLoose("20200226")).toBe("2020-02-26");
    expect(parseDateLoose("26/02/2020")).toBe("2020-02-26");
    expect(parseDateLoose("2021-02-30")).toBeNull();
    expect(parseDateLoose("1800-01-01")).toBeNull();
    expect(parseDateLoose("")).toBeNull();
  });
  it("derives the GoC fiscal year (Apr–Mar)", () => {
    expect(fiscalYearOf("2020-03-31")).toBe("2019-2020");
    expect(fiscalYearOf("2020-04-01")).toBe("2020-2021");
    expect(fiscalYearOf(null)).toBeNull();
  });
  it("normalises fiscal-year labels", () => {
    expect(normFiscalYear("2023-2024")).toBe("2023-2024");
    expect(normFiscalYear("2023-24")).toBe("2023-2024");
    expect(normFiscalYear("2023")).toBe("2023-2024");
    expect(normFiscalYear("2023-2025")).toBeNull();
    expect(normFiscalYear("; DROP TABLE")).toBeNull();
  });
});

describe("normBn / nz / parseTextArray", () => {
  it("reduces a business number to 9 digits", () => {
    expect(normBn("835752437")).toBe("835752437");
    expect(normBn("835752437RC0001")).toBe("835752437");
    expect(normBn("12345")).toBe("");
  });
  it("nz turns blanks into null", () => {
    expect(nz("  ")).toBeNull();
    expect(nz(" x ")).toBe("x");
  });
  it("parses recombinant _text arrays", () => {
    expect(parseTextArray("{CA,NA}")).toEqual(["CA", "NA"]);
    expect(parseTextArray("CA, GP")).toEqual(["CA", "GP"]);
    expect(parseTextArray("")).toEqual([]);
  });
});
