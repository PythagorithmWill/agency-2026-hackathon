import type { EvaluationResult } from "../types";
import { query } from "../db/pool";

/**
 * Evaluation store: Postgres-backed (schema `app`, owned by the Glassbox
 * database), with an in-process cache in front of it.
 *
 * Why: the previous Map-only store lost every evaluation, proof token and
 * verify link within minutes on Amplify SSR compute — each invocation may
 * land on a fresh process. Now a write goes to `app.evaluations` and the
 * cache; a read checks the cache then the table.
 *
 * Degrades honestly: if the database refuses writes (a read-only corpus
 * host, or the `app` schema missing), we keep the memory path and log a
 * SHIPPING_VOLATILE_STORE warning so the operator can see it in CloudWatch.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pythStore: Map<string, EvaluationResult> | undefined;
  // eslint-disable-next-line no-var
  var __pythStoreReady: Promise<boolean> | undefined;
}

const cache: Map<string, EvaluationResult> =
  globalThis.__pythStore ?? (globalThis.__pythStore = new Map());

const TABLE = "app.evaluations";

/** Create the table once per process; resolves false if the DB can't host it. */
/**
 * Only persist to a database Pythagorithm owns. The hackathon corpus host on
 * Render is off-limits for writes (PROJECT-RULES R2) even though the
 * credentials would technically allow DDL — so we key on the host, not on
 * whether the write happens to succeed.
 */
export function isOwnedAppDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".rds.amazonaws.com") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      process.env.EVALUATION_STORE_HOST_ALLOW === host
    );
  } catch {
    return false;
  }
}

function ensureTable(): Promise<boolean> {
  if (globalThis.__pythStoreReady) return globalThis.__pythStoreReady;
  globalThis.__pythStoreReady = (async () => {
    if (!isOwnedAppDatabase(process.env.DATABASE_URL)) {
      console.warn(
        "[store] SHIPPING_VOLATILE_STORE — DATABASE_URL is not a Pythagorithm-owned host; evaluations are memory-only (R2: never write to the corpus host).",
      );
      return false;
    }
    try {
      // If the table already exists (e.g. created by the admin role during a
      // load), do NOT run DDL: "CREATE ... IF NOT EXISTS" still requires
      // ownership and would throw "must be owner of table", which used to
      // silently disable persistence even though INSERT/SELECT were fine.
      const exists = await query<{ ok: string | null }>(
        `SELECT to_regclass('${TABLE}')::text AS ok`,
      );
      if (exists.rows[0]?.ok) {
        await query(`SELECT 1 FROM ${TABLE} LIMIT 1`); // proves SELECT privilege
        return true;
      }
      await query(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           evaluation_id text PRIMARY KEY,
           proof_id      text NOT NULL,
           created_at    timestamptz NOT NULL,
           result        jsonb NOT NULL
         )`,
      );
      try {
        await query(`CREATE INDEX IF NOT EXISTS evaluations_proof_id_idx ON ${TABLE} (proof_id)`);
      } catch (err) {
        console.warn("[store] index not created (non-fatal):", (err as Error).message);
      }
      return true;
    } catch (err) {
      console.warn(
        "[store] SHIPPING_VOLATILE_STORE — app.evaluations unavailable, evaluations will not survive process restarts:",
        (err as Error).message,
      );
      return false;
    }
  })();
  return globalThis.__pythStoreReady;
}

export async function saveEvaluation(e: EvaluationResult): Promise<void> {
  cache.set(e.evaluationId, e);
  if (!(await ensureTable())) return;
  try {
    await query(
      `INSERT INTO ${TABLE} (evaluation_id, proof_id, created_at, result)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (evaluation_id) DO UPDATE SET result = EXCLUDED.result`,
      [e.evaluationId, e.proofToken.proofId, e.createdAt, JSON.stringify(e)],
    );
  } catch (err) {
    console.warn("[store] persist failed (kept in memory):", (err as Error).message);
  }
}

export async function loadEvaluation(id: string): Promise<EvaluationResult | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  if (!(await ensureTable())) return null;
  try {
    const r = await query<{ result: EvaluationResult }>(
      `SELECT result FROM ${TABLE} WHERE evaluation_id = $1`,
      [id],
    );
    const row = r.rows[0];
    if (!row) return null;
    cache.set(id, row.result);
    return row.result;
  } catch (err) {
    console.warn("[store] load failed:", (err as Error).message);
    return null;
  }
}

export async function recentEvaluations(limit = 10): Promise<EvaluationResult[]> {
  if (await ensureTable()) {
    try {
      const r = await query<{ result: EvaluationResult }>(
        `SELECT result FROM ${TABLE} ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
      return r.rows.map((row) => row.result);
    } catch (err) {
      console.warn("[store] recent failed (memory only):", (err as Error).message);
    }
  }
  return Array.from(cache.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
