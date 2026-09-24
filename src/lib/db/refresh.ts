import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { resolvePgConnection } from "./pool";

/**
 * Write-side helpers for the offline refresh scripts
 * (scripts/refresh-derived.ts, scripts/refresh-loops.ts). Request-path
 * code never imports this module: the app role only reads.
 *
 * Everything here operates ONLY on schema `app`. The corpus schemas
 * (cra, fed, ab, general) are never altered.
 */

const APP = "app";
const NAME = /^[a-z_][a-z0-9_]*$/;

function assertName(n: string): string {
  if (!NAME.test(n)) throw new Error(`refusing unsafe identifier: ${n}`);
  return n;
}

/** Connection for DDL + bulk writes. Separate from the read pools in pool.ts. */
export function adminPool(databaseUrl: string): Pool {
  return new Pool({
    ...resolvePgConnection(databaseUrl),
    max: 2,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 15_000,
  });
}

export function describeDb(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/** Run sql/migrations/001_canonical.sql (idempotent). */
export async function applyMigration(client: PoolClient, file = "sql/migrations/001_canonical.sql"): Promise<void> {
  const sql = readFileSync(path.resolve(process.cwd(), file), "utf8");
  await client.query(sql);
}

/**
 * Build `app.<table>__new` as a structural copy of `app.<table>`, let
 * `fill` populate it, copy every index (and the primary key) onto it,
 * then swap the two inside one short transaction. Readers keep seeing
 * the old table until the swap commits; nothing ever observes an empty
 * table. Returns the row count reported by `fill`.
 */
export async function buildAndSwap(
  client: PoolClient,
  table: string,
  fill: (tmpQualified: string) => Promise<number>,
  log: (msg: string) => void = () => undefined,
): Promise<number> {
  assertName(table);
  const tmp = `${table}__new`;
  const qOld = `${APP}.${table}`;
  const qTmp = `${APP}.${tmp}`;

  await client.query(`DROP TABLE IF EXISTS ${qTmp}`);
  await client.query(`CREATE TABLE ${qTmp} (LIKE ${qOld} INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`);

  const t0 = Date.now();
  const rows = await fill(qTmp);
  log(`  filled ${qTmp}: ${rows.toLocaleString("en-CA")} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Indexes (the primary key's backing index is listed here too).
  const idx = await client.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2 ORDER BY indexname`,
    [APP, table],
  );
  const pk = await client.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'`,
    [qOld],
  );
  const t1 = Date.now();
  for (const { indexname, indexdef } of idx.rows) {
    assertName(indexname);
    const needle = ` ON ${APP}.${table} `;
    if (!indexdef.includes(needle) || !indexdef.includes(`INDEX ${indexname} `)) {
      throw new Error(`unexpected indexdef for ${indexname}: ${indexdef}`);
    }
    const def = indexdef
      .replace(`INDEX ${indexname} `, `INDEX ${indexname}__new `)
      .replace(needle, ` ON ${qTmp} `);
    await client.query(def);
  }
  log(`  built ${idx.rows.length} indexes in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  await client.query(`ANALYZE ${qTmp}`);

  // Swap. lock_timeout guards against a stuck reader holding the old
  // table; the whole transaction is a handful of catalogue updates.
  for (let attempt = 1; ; attempt++) {
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '30s'");
      await client.query(`DROP TABLE ${qOld}`);
      await client.query(`ALTER TABLE ${qTmp} RENAME TO ${table}`);
      for (const { indexname } of idx.rows) {
        await client.query(`ALTER INDEX ${APP}.${indexname}__new RENAME TO ${indexname}`);
      }
      for (const { conname } of pk.rows) {
        assertName(conname);
        await client.query(`ALTER TABLE ${qOld} ADD CONSTRAINT ${conname} PRIMARY KEY USING INDEX ${conname}`);
      }
      await client.query("COMMIT");
      break;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (attempt >= 3) throw err;
      log(`  swap attempt ${attempt} failed (${(err as Error).message}); retrying`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  return rows;
}

/** Multi-row parameterised INSERT in batches (≤ 65,535 params per statement). */
export async function batchInsert(
  client: PoolClient,
  qualifiedTable: string,
  columns: string[],
  rows: unknown[][],
  batchSize = 500,
): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = columns.map(assertName).join(", ");
  const size = Math.max(1, Math.min(batchSize, Math.floor(60_000 / columns.length)));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const ph = row.map((v) => {
        values.push(v);
        return `$${values.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await client.query(`INSERT INTO ${qualifiedTable} (${cols}) VALUES ${tuples.join(", ")}`, values);
    inserted += chunk.length;
  }
  return inserted;
}

export async function setMeta(client: PoolClient, key: string, value: unknown): Promise<void> {
  await client.query(
    `INSERT INTO app.refresh_meta (key, value, computed_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function grantAppRole(client: PoolClient): Promise<boolean> {
  const r = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'glassbox_app'`);
  if (r.rowCount === 0) return false;
  await client.query(`GRANT USAGE ON SCHEMA app TO glassbox_app`);
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA app TO glassbox_app`);
  return true;
}

/** Wall-clock helper for step logging. */
export async function timed<T>(label: string, fn: () => Promise<T>, log: (m: string) => void): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  const ms = Date.now() - t0;
  log(`✓ ${label.padEnd(40)} ${(ms / 1000).toFixed(1).padStart(8)}s`);
  return { value, ms };
}
