import { describe, it, expect } from "vitest";
import { searchCorpus } from "../retrieval";

/**
 * Signature-only tests — exercises the searchCorpus type contract without
 * issuing a live DB query. Live queries belong in e2e/. The function must
 * accept (queryText, awardingDept?, limit?) and return a SearchResult
 * with records / bySource / latencyMs / retrievalMode.
 */
describe("searchCorpus signature", () => {
  it("is a function with at least one declared parameter", () => {
    expect(typeof searchCorpus).toBe("function");
    expect(searchCorpus.length).toBeGreaterThanOrEqual(1);
  });

  it("returns a SearchResult with empty records for an empty query (no DB hit)", async () => {
    const result = await searchCorpus("");
    expect(result.records).toEqual([]);
    expect(result.bySource).toEqual({
      fed: 0,
      ab_grants: 0,
      ab_contracts: 0,
      general: 0,
    });
    expect(result.retrievalMode).toBe("keyword");
  });

  it("returns a SearchResult with empty records for whitespace-only query", async () => {
    const result = await searchCorpus("   ");
    expect(result.records).toEqual([]);
    expect(result.bySource.fed).toBe(0);
  });
});
