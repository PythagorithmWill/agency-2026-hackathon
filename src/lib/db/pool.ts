import { Pool, type QueryResult, type QueryResultRow } from "pg";

/**
 * The hackathon Render Postgres replica is read-only and uses self-signed SSL.
 * `rejectUnauthorized: false` is required by the host, not a security relaxation
 * — we never write to this connection (PROJECT-RULES R2).
 *
 * Pool sized small (max 10) because every query path is either pre-warmed (cache)
 * or bounded to a single entity. Aggressive timeouts so we fall back to local DB
 * fast under conference-WiFi conditions.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("render.com") ||
    process.env.DATABASE_URL?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  query_timeout: 8_000,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>({
      text,
      values: params as unknown[],
    });
  } catch (err: unknown) {
    const e = err as { code?: string; name?: string; message?: string };
    console.error("[DB] query failed:", e.message ?? String(err), {
      code: e.code ?? "unknown",
      name: e.name ?? "Error",
      text: text.slice(0, 120),
    });
    throw err;
  }
}

export async function withSearchPath<T>(
  schemas: ReadonlyArray<string>,
  fn: () => Promise<T>,
): Promise<T> {
  const ordered = [...schemas, "public"].join(", ");
  await pool.query(`SET search_path TO ${ordered}`);
  return fn();
}

export async function closePool(): Promise<void> {
  await pool.end();
  if (longPool) {
    await longPool.end();
    longPool = null;
  }
}

/**
 * Separate long-running pool for offline precompute pipelines. The fast
 * pool above has a hard 8s query_timeout to keep request-path code
 * snappy under conference-WiFi conditions, but full-corpus aggregations
 * across the F-3 max-amendment CTE on 1.27M rows take 10–30s. The
 * snapshot pipeline uses this pool instead.
 *
 * Single connection, no timeout on the client side. Server-side
 * statement_timeout is still set per-query.
 */
let longPool: Pool | null = null;
function getLongPool(): Pool {
  if (longPool) return longPool;
  longPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_URL?.includes("render.com") ||
      process.env.DATABASE_URL?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // No query_timeout — long aggregations need 10–30s
  });
  return longPool;
}

/**
 * Long-budget query — uses the separate longPool with no client-side
 * timeout. Sets a server-side statement_timeout per query as a guard
 * against runaway statements. Do NOT call this from request-path code.
 */
export async function longQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
  timeoutMs = 60_000,
): Promise<QueryResult<T>> {
  const client = await getLongPool().connect();
  try {
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    return await client.query<T>({ text, values: params as unknown[] });
  } finally {
    client.release();
  }
}
