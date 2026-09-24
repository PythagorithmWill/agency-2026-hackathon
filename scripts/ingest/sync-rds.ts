/**
 * Copy an already-loaded source table from the LOCAL full copy to RDS using
 * psql COPY pipes (≈3× faster than parameterised INSERTs on this link:
 * measured 2,660 rows/s vs ~800 rows/s for corp.corporations, 2026-09-24).
 *
 *   npx tsx scripts/ingest/sync-rds.ts <schema.table> [--truncate] [--where "<sql>"] [--wait <minutes>]
 *
 * Steps: apply the schema's DDL on RDS (idempotent), stream rows from local
 * into a TEMP table on RDS, then INSERT … ON CONFLICT DO NOTHING into the
 * real table, so a re-run after a broken pipe just fills the gap. Only the
 * four schemas owned by scripts/ingest are allowed. Requires psql on PATH.
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { REPO_ROOT, applyDdl, assertRdsQuiet, countRows, grantApp, makePool, parseArgs, resolveTargetUrl, waitMinutes } from "./_lib";

const OWN = new Set(["fedc", "lobby", "elections", "corp"]);
const SQL_FILES: Record<string, string> = { fedc: "fedc.sql", lobby: "lobby.sql", elections: "elections.sql", corp: "corp.sql" };

async function main(): Promise<void> {
  const args = parseArgs();
  const table = process.argv.slice(2).find((a) => !a.startsWith("--") && /^[a-z_]+\.[a-z_]+$/.test(a));
  if (!table) throw new Error("usage: sync-rds.ts <schema.table> [--truncate] [--where \"<sql>\"]");
  const [schema] = table.split(".");
  if (!OWN.has(schema)) throw new Error(`schema ${schema} is not owned by scripts/ingest`);
  const where = typeof args.extra.where === "string" ? ` WHERE ${args.extra.where}` : "";

  const localUrl = resolveTargetUrl("local");
  const rdsUrl = resolveTargetUrl("rds");
  const rds = makePool(rdsUrl);
  try {
    await assertRdsQuiet(rds, true, waitMinutes(args));
    await applyDdl(rds, path.join(REPO_ROOT, "sql", "sources", SQL_FILES[schema]), schema);
    if (args.truncate) await rds.query(`TRUNCATE ${table}`);
    // Column list from the local table, excluding generated and default-timestamp columns.
    const local = makePool(localUrl);
    const cols = (
      await local.query<{ c: string }>(
        `SELECT column_name AS c FROM information_schema.columns
          WHERE table_schema=$1 AND table_name=$2 AND is_generated='NEVER' AND column_name<>'loaded_at'
          ORDER BY ordinal_position`,
        [schema, table.split(".")[1]],
      )
    ).rows.map((r) => r.c);
    const before = await countRows(rds, table);
    const localCount = (await local.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}${where}`)).rows[0].n;
    await local.end();
    console.log(`[sync] ${table}: local ${Number(localCount).toLocaleString()} rows${where}; RDS has ${before.toLocaleString()} before`);

    const colList = cols.join(",");
    const t0 = Date.now();
    const src = spawn("psql", [localUrl, "-Atc", `\\copy (SELECT ${colList} FROM ${table}${where}) TO STDOUT`], { stdio: ["ignore", "pipe", "inherit"] });
    const dst = spawn(
      "psql",
      [rdsUrl, "-q", "-v", "ON_ERROR_STOP=1",
        "-c", `CREATE TEMP TABLE sync_tmp (LIKE ${table} INCLUDING DEFAULTS)`,
        "-c", `\\copy sync_tmp (${colList}) FROM STDIN`,
        "-c", `INSERT INTO ${table} (${colList}) SELECT ${colList} FROM sync_tmp ON CONFLICT DO NOTHING`,
        "-c", `ANALYZE ${table}`],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    let bytes = 0;
    src.stdout.on("data", (b: Buffer) => { bytes += b.length; });
    src.stdout.pipe(dst.stdin);
    const timer = setInterval(() => console.log(`[sync] ${(bytes / 1e6).toFixed(0)} MB sent, ${((Date.now() - t0) / 1000).toFixed(0)}s`), 30_000);
    const code = await new Promise<number>((res) => dst.on("close", (c) => res(c ?? 1)));
    clearInterval(timer);
    if (code !== 0) throw new Error(`psql (RDS side) exited ${code}`);
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);
    const after = await countRows(rds, table);
    console.log(`[sync] ${table}: RDS now ${after.toLocaleString()} rows (+${(after - before).toLocaleString()}) in ${seconds}s, ${(bytes / 1e6).toFixed(0)} MB`);
    await rds.query(`INSERT INTO ${schema}.ingest_log (source, file, rows_loaded, seconds, note) VALUES ($1,$2,$3,$4,$5)`,
      [`sync-rds:${table}`, "local agency26", after - before, Number(seconds), where || null]);
    await grantApp(rds, schema);
  } finally {
    await rds.end();
  }
}

// spawnSync guard: fail early with a clear message when psql is missing.
if (spawnSync("psql", ["--version"]).status !== 0) {
  console.error("psql not found on PATH");
  process.exit(1);
}
main().catch((err) => { console.error(err); process.exit(1); });
