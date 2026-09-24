import { query } from "./pool";

/**
 * Feature detection for the derived `app.*` layer (built offline by
 * scripts/refresh-derived.ts and scripts/refresh-loops.ts).
 *
 * Every read path that can use a derived table asks `hasAppTable()`
 * first and falls back to the CTE / snapshot path when the table is
 * absent, so the site keeps working against a corpus-only database.
 *
 * "Present" means the table exists AND has at least one row (the
 * migration creates empty tables up front). Results are memoised per
 * process: the check is ~0.3 ms but it would otherwise run on every
 * request. A
 * negative answer is re-checked after NEGATIVE_TTL_MS so a refresh that
 * lands mid-process becomes visible without a restart; a positive
 * answer is kept for the life of the process (tables are swapped in
 * place, never dropped, by the refresh scripts). If a query against a
 * detected table later fails with `undefined_table` the caller should
 * call `forgetAppTable()` so the next request re-detects.
 */
const NEGATIVE_TTL_MS = 5 * 60 * 1000;

const memo = new Map<string, { present: boolean; checkedAt: number }>();
const inflight = new Map<string, Promise<boolean>>();

const VALID_NAME = /^[a-z_][a-z0-9_]*$/;

/**
 * Ops escape hatch / A-B switch: GLASSBOX_DISABLE_APP_TABLES=1 forces
 * every read path onto the CTE / snapshot fallback without touching the
 * database (used by the timing probe and available in production).
 */
function disabledByEnv(): boolean {
  const v = process.env.GLASSBOX_DISABLE_APP_TABLES;
  return v === "1" || v === "true";
}

export async function hasAppTable(table: string): Promise<boolean> {
  if (!VALID_NAME.test(table)) throw new Error(`invalid app table name: ${table}`);
  if (disabledByEnv()) return false;
  const hit = memo.get(table);
  if (hit) {
    if (hit.present) return true;
    if (Date.now() - hit.checkedAt < NEGATIVE_TTL_MS) return false;
  }
  const pending = inflight.get(table);
  if (pending) return pending;
  const p = (async () => {
    let present = false;
    try {
      // Present AND non-empty: the migration creates every table up
      // front, so an existing-but-unfilled table must still route to
      // the fallback path (otherwise totals would read as zero).
      const r = await query<{ present: boolean }>(
        `SELECT to_regclass($1) IS NOT NULL
            AND EXISTS (SELECT 1 FROM app.${table} LIMIT 1) AS present`,
        [`app.${table}`],
      );
      present = Boolean(r.rows[0]?.present);
    } catch (err) {
      // Unreachable DB: report absent but do not memoise for long —
      // the caller's fallback path will surface the real failure.
      console.warn(`[features] to_regclass(app.${table}) failed:`, (err as Error).message);
      present = false;
    }
    memo.set(table, { present, checkedAt: Date.now() });
    inflight.delete(table);
    return present;
  })();
  inflight.set(table, p);
  return p;
}

/** Drop the memoised answer (e.g. after an `undefined_table` error). */
export function forgetAppTable(table: string): void {
  memo.delete(table);
}

/** Test seam: clear every memoised answer. */
export function _resetFeatureMemoForTest(): void {
  memo.clear();
  inflight.clear();
}

/** pg error code for "relation does not exist". */
export function isUndefinedTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "42P01";
}
