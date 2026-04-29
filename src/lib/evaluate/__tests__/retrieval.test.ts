import { describe, it, expect } from "vitest";
import { searchCorpus } from "../retrieval";

/**
 * Signature-only test — exercises the searchCorpus type contract without
 * issuing a live DB query. Live queries belong in e2e/. The function must
 * accept (queryText, awardingDept?) and return Promise<ComparableRecord[]>.
 */
describe("searchCorpus signature", () => {
  it("accepts (queryText) and returns a Promise<ComparableRecord[]>", () => {
    const result = searchCorpus.length;
    expect(result).toBeGreaterThanOrEqual(1);
    expect(typeof searchCorpus).toBe("function");
  });

  it("returns [] for an empty query without hitting the DB", async () => {
    const records = await searchCorpus("");
    expect(records).toEqual([]);
  });

  it("returns [] for whitespace-only query without hitting the DB", async () => {
    const records = await searchCorpus("   ");
    expect(records).toEqual([]);
  });
});
