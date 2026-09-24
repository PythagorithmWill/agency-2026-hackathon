import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { RDS_GLOBAL_CA_BUNDLE } from "./rds-ca";

/**
 * The hackathon Render Postgres replica is read-only and uses self-signed SSL.
 * `rejectUnauthorized: false` is required by the host, not a security relaxation
 * — we never write to this connection (PROJECT-RULES R2).
 *
 * Pool sized small (max 10) because every query path is either pre-warmed (cache)
 * or bounded to a single entity. Aggressive timeouts so we fall back to local DB
 * fast under conference-WiFi conditions.
 */
/**
 * Pools are created lazily on first use. ES module imports are hoisted,
 * so the offline scripts/* runners that loadEnvLocal() before importing
 * this module would otherwise see DATABASE_URL = undefined at pool-init
 * time and fall back to a local postgres connection. Lazy init means
 * the env is read at first query, after the runner has populated it.
 */

/**
 * Resolve the connection string + TLS options for `pg`.
 *
 * Gotcha (verified 2026-09-24): when the URL carries `sslmode=…`, pg's
 * connection-string parser produces its own `ssl` object which OVERRIDES the
 * explicit `ssl` option passed to `new Pool()`. Against RDS that meant
 * "self-signed certificate in certificate chain" even with
 * rejectUnauthorized:false. So we strip every ssl* query parameter and set
 * `ssl` ourselves, per host:
 *   - *.rds.amazonaws.com  → verify against the embedded RDS CA bundle
 *   - *.render.com         → encrypted, unverified (Render's self-signed chain)
 *   - localhost/127.0.0.1  → plaintext
 *   - anything else        → encrypted-unverified if the URL asked for ssl, else plaintext
 */
export function resolvePgConnection(raw: string | undefined): {
  connectionString: string | undefined;
  ssl: { ca?: string; rejectUnauthorized: boolean } | undefined;
} {
  if (!raw) return { connectionString: undefined, ssl: undefined };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { connectionString: raw, ssl: undefined };
  }
  const wantedSsl =
    url.searchParams.has("sslmode") && url.searchParams.get("sslmode") !== "disable";
  for (const k of [...url.searchParams.keys()]) {
    if (k === "ssl" || k.startsWith("ssl")) url.searchParams.delete(k);
  }
  const host = url.hostname.toLowerCase();
  let ssl: { ca?: string; rejectUnauthorized: boolean } | undefined;
  if (host.endsWith(".rds.amazonaws.com")) {
    ssl = { ca: RDS_GLOBAL_CA_BUNDLE, rejectUnauthorized: true };
  } else if (host.endsWith(".render.com")) {
    ssl = { rejectUnauthorized: false };
  } else if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    ssl = undefined;
  } else if (wantedSsl) {
    ssl = { rejectUnauthorized: false };
  }
  return { connectionString: url.toString(), ssl };
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    ...resolvePgConnection(process.env.DATABASE_URL),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    query_timeout: 8_000,
    // query_timeout only abandons the client-side wait; without a
    // matching server-side statement_timeout the query keeps running
    // on the shared Render instance after the page has already given
    // up (verified: SHOW statement_timeout returned 0 before this).
    // pg sends this as a session startup parameter.
    statement_timeout: 8_000,
  });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  try {
    return await getPool().query<T>({
      text,
      values: params as unknown[],
    });
  } catch (err: unknown) {
    const e = err as { code?: string; name?: string; message?: string };
    const msg = e.message ?? String(err);
    // Pool query_timeout is an expected failure mode under contention —
    // every caller wraps with Promise.allSettled / catch. Log at warn
    // level so it doesn't trigger Next's dev error overlay. Real errors
    // (syntax, schema, connection-loss) still surface to console.error.
    const isTimeout = msg.toLowerCase().includes("timeout");
    const logger = isTimeout ? console.warn : console.error;
    logger("[DB] query failed:", msg, {
      code: e.code ?? "unknown",
      name: e.name ?? "Error",
      text: text.slice(0, 120),
    });
    throw err;
  }
}

/**
 * Classify a failed query so callers can tell the user the truth: a
 * statement/pool timeout ("the query took too long") is a very different
 * situation from a connection failure ("the database host is gone").
 * Before this existed every rejection was reported as "timed out — the
 * database is busy", which is exactly wrong when the host is unreachable.
 */
export type DbFailureKind = "timeout" | "unreachable" | "error";

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "EPIPE",
  "08000", "08001", "08003", "08004", "08006", "57P01", "57P02", "57P03",
]);
const UNREACHABLE_RE =
  /connection terminated|connection (refused|closed|reset|ended)|trying to connect|ssl connection has been closed|getaddrinfo|database system is (starting|shutting)|too many (clients|connections)|password authentication failed|does not exist$/i;

export function classifyDbFailure(err: unknown): DbFailureKind {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? String(err ?? "");
  if (UNREACHABLE_CODES.has(code) || UNREACHABLE_RE.test(msg)) return "unreachable";
  if (code === "57014" || /timeout|canceling statement/i.test(msg)) return "timeout";
  return "error";
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
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
    ...resolvePgConnection(process.env.DATABASE_URL),
    // 6 connections so the search path (3 parallel queries) and
    // detector workloads don't starve each other. Render's shared
    // replica gives us ~20-30 conns total; 10 fast + 6 long leaves
    // headroom for snapshot-build runs.
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
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
    // SET LOCAL is a no-op outside a transaction block (Postgres only
    // warns), so the per-query server-side guard must run inside one.
    // READ ONLY doubles as a belt-and-braces guard for PROJECT-RULES R2.
    await client.query("BEGIN READ ONLY");
    try {
      await client.query(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`);
      const result = await client.query<T>({ text, values: params as unknown[] });
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
  }
}
