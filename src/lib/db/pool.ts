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
    const code = (err as { code?: string }).code ?? "unknown";
    console.error("[DB] query failed", { code, text: text.slice(0, 120) });
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
}
