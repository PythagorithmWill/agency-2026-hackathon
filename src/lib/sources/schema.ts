/**
 * Feature detection for optional source schemas (fedc, lobby, elections,
 * corp). The app must run against a database where none of these have been
 * loaded, so every helper in src/lib/sources/* asks `hasTable()` first and
 * returns an empty, well-typed result when the table is absent.
 *
 * Results are cached per process for a short TTL; a freshly-loaded schema
 * becomes visible without a restart.
 */
import { query } from "../db/pool";

const TTL_MS = 60_000;
const cache = new Map<string, { ok: boolean; at: number }>();

/** Only accept plain `schema.table` identifiers — never interpolate user input. */
const IDENT_RE = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;

export async function hasTable(qualified: string): Promise<boolean> {
  if (!IDENT_RE.test(qualified)) throw new Error(`hasTable: bad identifier ${qualified}`);
  const hit = cache.get(qualified);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.ok;
  let ok = false;
  try {
    const r = await query<{ reg: string | null }>("SELECT to_regclass($1)::text AS reg", [qualified]);
    ok = r.rows[0]?.reg != null;
  } catch {
    ok = false;
  }
  cache.set(qualified, { ok, at: now });
  return ok;
}

/** Test hook. */
export function resetSchemaCache(): void {
  cache.clear();
}

/** Shape every source helper returns so callers can tell "absent" from "empty". */
export interface SourceResult<T> {
  available: boolean;
  rows: T[];
}

export const EMPTY = <T>(): SourceResult<T> => ({ available: false, rows: [] });
