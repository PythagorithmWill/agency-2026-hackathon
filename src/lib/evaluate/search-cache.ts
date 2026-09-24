import { corpusCached, SEARCH_REVALIDATE_S } from "../cache";
import { searchCorpus, type SearchResult } from "./retrieval";

/** Thrown inside the cached fn so a degraded result is returned but not stored. */
class DegradedSearch extends Error {
  constructor(public readonly result: SearchResult) {
    super("degraded search result (not cached)");
  }
}

const cached = corpusCached(
  async (q: string, dept: string | undefined, limit: number | undefined) => {
    const r = await searchCorpus(q, dept, limit);
    if (Object.keys(r.sourceFailures).length > 0) throw new DegradedSearch(r);
    return r;
  },
  "search",
  SEARCH_REVALIDATE_S,
);

/**
 * searchCorpus with a shared 1h cache for complete results. Partial or
 * failed results are returned to the caller but never cached.
 */
export async function searchCorpusCached(
  q: string,
  dept?: string,
  limit?: number,
): Promise<SearchResult> {
  try {
    return await cached(q, dept, limit);
  } catch (err) {
    if (err instanceof DegradedSearch) return err.result;
    throw err;
  }
}
