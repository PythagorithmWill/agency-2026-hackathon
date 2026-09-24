/**
 * Shared toolkit for the scripts/ingest/* loaders.
 *
 *   npx tsx scripts/ingest/<source>.ts [--target local|rds|<postgres url>]
 *                                      [--limit N] [--truncate] [--skip-download]
 *
 * - local (default): postgresql://localhost:5432/agency26 (writable full copy)
 * - rds: admin URL from Secrets Manager `glassbox/database-admin-url` (+sslmode=require)
 *
 * All loaders are resumable: downloads use `curl -C -`, tables are created
 * with IF NOT EXISTS, and inserts are ON CONFLICT upserts on a natural key,
 * so re-running after a crash simply continues. `--truncate` reloads from
 * scratch (needed when the upstream file is a new snapshot whose row
 * ordering changed, e.g. Elections Canada where the key is the line number).
 */
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { resolvePgConnection } from "../../src/lib/db/pool";
import { CsvParser } from "../../src/lib/sources/csv";

export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const INGEST_DIR = path.join(REPO_ROOT, "data", "ingest");
export const APP_ROLE = "glassbox_app";
const LOCAL_URL = "postgresql://localhost:5432/agency26";

export interface IngestArgs {
  target: string;
  limit: number | null;
  truncate: boolean;
  skipDownload: boolean;
  batch: number;
  extra: Record<string, string | boolean>;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): IngestArgs {
  const a: IngestArgs = { target: "local", limit: null, truncate: false, skipDownload: false, batch: 1000, extra: {} };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--target") a.target = next();
    else if (k === "--limit") a.limit = Number(next());
    else if (k === "--batch") a.batch = Number(next());
    else if (k === "--truncate") a.truncate = true;
    else if (k === "--skip-download") a.skipDownload = true;
    else if (k.startsWith("--")) {
      const name = k.slice(2);
      const v = argv[i + 1];
      if (v !== undefined && !v.startsWith("--")) { a.extra[name] = v; i++; } else a.extra[name] = true;
    }
  }
  if (a.limit !== null && (!Number.isFinite(a.limit) || a.limit <= 0)) throw new Error("--limit must be a positive number");
  return a;
}

export function resolveTargetUrl(target: string): string {
  if (target === "local") return process.env.INGEST_LOCAL_URL ?? LOCAL_URL;
  if (target === "rds") {
    const r = spawnSync(
      "aws",
      ["secretsmanager", "get-secret-value", "--secret-id", "glassbox/database-admin-url", "--region", "us-east-1", "--query", "SecretString", "--output", "text"],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`aws secretsmanager failed: ${r.stderr}`);
    const url = r.stdout.trim();
    return url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
  }
  if (/^postgres(ql)?:\/\//.test(target)) return target;
  throw new Error(`unknown --target ${target}`);
}

export function makePool(url: string): Pool {
  return new Pool({ ...resolvePgConnection(url), max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000 });
}

export function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable url)";
  }
}

/** Guard: refuse to write to RDS while a federal grants merge is still running. */
export async function assertRdsQuiet(pool: Pool, isRds: boolean, waitMinutes = 0): Promise<void> {
  if (!isRds) return;
  const deadline = Date.now() + waitMinutes * 60_000;
  for (;;) {
    const r = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM pg_stat_activity WHERE state='active' AND query ILIKE 'INSERT INTO fed.grants%'",
    );
    if (Number(r.rows[0]?.n ?? "0") === 0) return;
    if (Date.now() >= deadline) throw new Error("RDS busy: a fed.grants INSERT is still active — retry later (or pass --wait <minutes>)");
    console.log(`[rds] fed.grants merge still active — waiting 30s (until ${new Date(deadline).toLocaleTimeString()})`);
    await new Promise((res) => setTimeout(res, 30_000));
  }
}

/** Minutes to wait for RDS to be quiet, from --wait N (default 0 = fail fast). */
export function waitMinutes(args: IngestArgs): number {
  const w = args.extra.wait;
  return typeof w === "string" && Number.isFinite(Number(w)) ? Number(w) : w === true ? 60 : 0;
}

/** Only the four schemas this toolkit is allowed to create/grant. */
const OWN_SCHEMAS = new Set(["fedc", "lobby", "elections", "corp"]);

export async function applyDdl(pool: Pool, sqlFile: string, schema: string): Promise<void> {
  if (!OWN_SCHEMAS.has(schema)) throw new Error(`schema ${schema} is not owned by scripts/ingest`);
  const sql = readFileSync(sqlFile, "utf8");
  await pool.query(sql);
}

export async function grantApp(pool: Pool, schema: string): Promise<void> {
  if (!OWN_SCHEMAS.has(schema)) throw new Error(`schema ${schema} is not owned by scripts/ingest`);
  const role = await pool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [APP_ROLE]);
  if (role.rowCount === 0) {
    console.log(`[grant] role ${APP_ROLE} absent on this server — skipping grants`);
    return;
  }
  await pool.query(`GRANT USAGE ON SCHEMA ${schema} TO ${APP_ROLE}`);
  await pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${APP_ROLE}`);
  await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${APP_ROLE}`);
  console.log(`[grant] ${schema}: USAGE + SELECT granted to ${APP_ROLE}`);
}

/** Resumable download via curl (-C -). Returns the local path. */
export function download(url: string, dest: string, opts: { userAgent?: string; expectedBytes?: number } = {}): string {
  mkdirSync(path.dirname(dest), { recursive: true });
  if (existsSync(dest) && opts.expectedBytes && statSync(dest).size === opts.expectedBytes) {
    console.log(`[download] ${path.basename(dest)} already complete (${opts.expectedBytes} bytes)`);
    return dest;
  }
  const args = ["-sSL", "--retry", "5", "--retry-delay", "3", "-C", "-", "-o", dest, url];
  if (opts.userAgent) args.unshift("-A", opts.userAgent);
  console.log(`[download] ${url} → ${path.relative(REPO_ROOT, dest)}`);
  const r = spawnSync("curl", args, { stdio: "inherit" });
  // curl exits 33 when the file is already complete and the server rejects the range; treat as done.
  if (r.status !== 0 && r.status !== 33) throw new Error(`curl exited ${r.status} for ${url}`);
  console.log(`[download] done: ${statSync(dest).size} bytes`);
  return dest;
}

/** Ensure a zip is extracted (idempotent). */
export function unzip(zipPath: string, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync("unzip", ["-oq", zipPath, "-d", outDir], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`unzip exited ${r.status} for ${zipPath}`);
}

/** Stream a CSV file as objects keyed by the header row. */
export async function* streamCsvObjects(
  file: string,
  opts: { encoding?: BufferEncoding; delimiter?: string; header?: (h: string[]) => string[]; stats?: { malformed: number } } = {},
): AsyncGenerator<{ line: number; row: Record<string, string> }> {
  const parser = new CsvParser({ delimiter: opts.delimiter });
  const stream = createReadStream(file, { encoding: opts.encoding ?? "utf8", highWaterMark: 1 << 20 });
  let header: string[] | null = null;
  let line = 0;
  const stats = opts.stats ?? { malformed: 0 };
  const emit = function* (records: string[][]) {
    for (const rec of records) {
      if (!header) {
        header = (opts.header ?? ((h) => h))(rec.map((h) => h.trim()));
        continue;
      }
      line++;
      if (rec.length !== header.length) {
        // Short/long records: a truncated download tail, or a broken quote.
        // Count and skip rather than load a misaligned row.
        stats.malformed++;
        if (stats.malformed <= 5) console.warn(`[csv] line ${line}: ${rec.length} fields, expected ${header.length} — skipped`);
        continue;
      }
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = rec[i] ?? "";
      yield { line, row };
    }
  };
  for await (const chunk of stream) yield* emit(parser.push(chunk as string));
  yield* emit(parser.end());
}

export interface UpsertSpec {
  table: string;
  columns: readonly string[];
  conflict: readonly string[];
  /** Columns to update on conflict; default = all non-conflict columns. Pass [] for DO NOTHING. */
  update?: readonly string[];
}

/** Multi-row INSERT … ON CONFLICT. Rows are arrays aligned with spec.columns. */
export async function upsertBatch(pool: Pool, spec: UpsertSpec, rows: unknown[][]): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = spec.columns;
  const maxRows = Math.floor(60_000 / cols.length);
  let written = 0;
  for (let start = 0; start < rows.length; start += maxRows) {
    const slice = rows.slice(start, start + maxRows);
    const values: unknown[] = [];
    const tuples: string[] = [];
    let p = 1;
    for (const r of slice) {
      const ph: string[] = [];
      for (let c = 0; c < cols.length; c++) {
        ph.push(`$${p++}`);
        values.push(r[c] ?? null);
      }
      tuples.push(`(${ph.join(",")})`);
    }
    const update = spec.update ?? cols.filter((c) => !spec.conflict.includes(c));
    const onConflict =
      update.length === 0
        ? "DO NOTHING"
        : `DO UPDATE SET ${update.map((c) => `${c}=EXCLUDED.${c}`).join(", ")}`;
    const sql = `INSERT INTO ${spec.table} (${cols.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT (${spec.conflict.join(",")}) ${onConflict}`;
    const r = await pool.query(sql, values);
    written += r.rowCount ?? 0;
  }
  return written;
}

export class Progress {
  private readonly t0 = Date.now();
  private last = Date.now();
  constructor(private readonly label: string, private readonly every = 50_000) {}
  tick(n: number, extra = ""): void {
    if (n % this.every !== 0) return;
    const now = Date.now();
    const rate = Math.round(this.every / ((now - this.last) / 1000));
    this.last = now;
    console.log(`[${this.label}] ${n.toLocaleString()} rows  (${rate.toLocaleString()} rows/s, ${((now - this.t0) / 1000).toFixed(0)}s)${extra ? "  " + extra : ""}`);
  }
  done(n: number): string {
    const s = ((Date.now() - this.t0) / 1000).toFixed(1);
    console.log(`[${this.label}] finished: ${n.toLocaleString()} rows in ${s}s`);
    return s;
  }
}

/** Common runner boilerplate so each loader is short. */
export async function withPool<T>(args: IngestArgs, fn: (pool: Pool, isRds: boolean) => Promise<T>): Promise<T> {
  const url = resolveTargetUrl(args.target);
  const isRds = url.includes(".rds.amazonaws.com");
  console.log(`[target] ${describeTarget(url)}${isRds ? " (RDS)" : ""}${args.limit ? `  --limit ${args.limit}` : ""}${args.truncate ? "  --truncate" : ""}`);
  const pool = makePool(url);
  try {
    await assertRdsQuiet(pool, isRds, waitMinutes(args));
    return await fn(pool, isRds);
  } finally {
    await pool.end();
  }
}

export function countRows(pool: Pool, table: string): Promise<number> {
  return pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`).then((r) => Number(r.rows[0]?.n ?? "0"));
}

/** Record a load in <schema>.ingest_log so docs and the app can show provenance. */
export async function logIngest(
  pool: Pool,
  schema: string,
  entry: { source: string; file: string; rows: number; seconds: string; note?: string },
): Promise<void> {
  if (!OWN_SCHEMAS.has(schema)) throw new Error(`schema ${schema} is not owned by scripts/ingest`);
  await pool.query(
    `INSERT INTO ${schema}.ingest_log (source, file, rows_loaded, seconds, note) VALUES ($1,$2,$3,$4,$5)`,
    [entry.source, entry.file, entry.rows, Number(entry.seconds), entry.note ?? null],
  );
}
