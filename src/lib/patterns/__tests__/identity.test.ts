import { describe, it, expect } from "vitest";
import { isNullLikeId, normalizeBn } from "../identity";

describe("identity — null-like recipient identifiers", () => {
  it("treats null / undefined / empty as absent", () => {
    expect(isNullLikeId(null)).toBe(true);
    expect(isNullLikeId(undefined)).toBe(true);
    expect(isNullLikeId("")).toBe(true);
    expect(isNullLikeId("   ")).toBe(true);
  });

  it("treats the literal placeholder tokens as absent, case-insensitively and trimmed", () => {
    for (const v of ["None", "none", " NONE ", "null", "NULL", "undefined", "n/a", "N/A", "-", "nan"]) {
      expect(isNullLikeId(v), v).toBe(true);
      expect(normalizeBn(v), v).toBeNull();
    }
  });

  it("treats all-zero digit strings as absent (publisher placeholder BNs)", () => {
    for (const v of ["0", "00", "000000000", "0000000000", " 0 "]) {
      expect(isNullLikeId(v), v).toBe(true);
      expect(normalizeBn(v), v).toBeNull();
    }
  });

  it("keeps real BNs, trimmed", () => {
    expect(normalizeBn("108162330")).toBe("108162330");
    expect(normalizeBn(" 108162330RR0001 ")).toBe("108162330RR0001");
    expect(normalizeBn("000000001")).toBe("000000001");
    expect(isNullLikeId("129253308RR0001")).toBe(false);
  });

  it("does not swallow legal names that merely start with a placeholder token", () => {
    expect(isNullLikeId("Nonesuch Foundation")).toBe(false);
    expect(isNullLikeId("0 Degrees Inc.")).toBe(false);
  });
});
