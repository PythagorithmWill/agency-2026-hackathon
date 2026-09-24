import { unstable_cache } from "next/cache";

/**
 * Corpus reads are immutable between data refreshes (quarterly), and every
 * refresh ships as a new deploy, which starts a fresh Next data cache. So a
 * successful corpus read can be cached for a day across all visitors; a
 * failed read (throw) is never cached — unstable_cache only stores resolved
 * values — so an outage never gets frozen into the cache.
 */
export const CORPUS_REVALIDATE_S = 86_400;
export const SEARCH_REVALIDATE_S = 3_600;

export function corpusCached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string,
  revalidate: number = CORPUS_REVALIDATE_S,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, ["corpus", key], { revalidate, tags: ["corpus"] });
}
