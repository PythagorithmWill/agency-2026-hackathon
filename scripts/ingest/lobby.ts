/**
 * Loader: Registry of Lobbyists open data (registrations + monthly
 * communication reports).
 *
 *   npx tsx scripts/ingest/lobby.ts [--target local|rds] [--limit N] [--truncate] [--skip-download]
 *
 * Sources (verified via CKAN 2026-09-24; see sql/sources/lobby.sql):
 *   registrations_enregistrements_ocl_cal.zip  (dataset 70ef2117-…, resource ab35c449-…)
 *   communications_ocl_cal.zip                 (dataset a34eb330-…, resource fb2843fb-…)
 *
 * BLOCKER: lobbycanada.gc.ca serves both zips (and the XLSX data
 * dictionaries) behind a Cloudflare browser challenge — curl gets HTTP 403
 * regardless of User-Agent. This loader does not try to defeat that. Place
 * the two zips in data/ingest/lobby/ (download them in a browser from the
 * dataset pages on open.canada.ca) and run with --skip-download.
 *
 * Because the dictionaries could not be read, tables are created from the
 * CSV headers at load time: one all-text table per CSV, lobby.<stem>, with
 * src_line as the key and an index on upper(trim(<col>)) for every column
 * whose name contains "name"/"nom". Once the layout is known, add typed
 * views on top (see docs/DATA-SOURCES.md).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { INGEST_DIR, Progress, REPO_ROOT, applyDdl, countRows, download, grantApp, logIngest, parseArgs, streamCsvObjects, unzip, upsertBatch, withPool } from "./_lib";
import { toIdent, uniqueIdents } from "../../src/lib/sources/lobby";

export const LOBBY_SOURCE = {
  licence: "ca-odla-aldg",
  files: [
    { datasetId: "70ef2117-1095-4d77-80eb-b87f2bada2a4", resourceId: "ab35c449-ef35-40cf-bf96-0b0589c1eba5", url: "https://lobbycanada.gc.ca/media/zwcjycef/registrations_enregistrements_ocl_cal.zip", name: "registrations.zip" },
    { datasetId: "a34eb330-7136-4f5e-9f5f-3ba41df58b06", resourceId: "fb2843fb-f5a7-4e4c-92ea-004e65313fe9", url: "https://lobbycanada.gc.ca/media/mqbbmaqk/communications_ocl_cal.zip", name: "communications.zip" },
  ],
};

function listCsvs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.csv$/i.test(f))
    .map((f) => path.join(dir, f))
    .filter((f) => statSync(f).isFile());
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dir = path.join(INGEST_DIR, "lobby");
  for (const f of LOBBY_SOURCE.files) {
    const zip = path.join(dir, f.name);
    if (!args.skipDownload && !existsSync(zip)) {
      try { download(f.url, zip, { userAgent: "Mozilla/5.0" }); } catch (e) { console.warn(`[lobby] ${(e as Error).message}`); }
    }
    if (!existsSync(zip) || statSync(zip).size < 1024) {
      throw new Error(`[lobby] ${f.name} missing or not a zip (Cloudflare challenge?). Download it in a browser from https://open.canada.ca/data/en/dataset/${f.datasetId} into ${dir}/ and re-run with --skip-download.`);
    }
    unzip(zip, path.join(dir, path.basename(f.name, ".zip")));
  }
  const csvs = listCsvs(dir);
  if (csvs.length === 0) throw new Error("[lobby] no CSV files found after extraction");

  await withPool(args, async (pool) => {
    await applyDdl(pool, path.join(REPO_ROOT, "sql", "sources", "lobby.sql"), "lobby");
    for (const file of csvs) {
      const stem = toIdent(path.basename(file, path.extname(file)), 0).replace(/_export$/, "");
      const table = `lobby.${stem}`;
      let cols: string[] | null = null;
      const progress = new Progress(table, 100_000);
      const stats = { malformed: 0 };
      let n = 0, written = 0;
      let batch: unknown[][] = [];
      let spec: { table: string; columns: string[]; conflict: string[] } | null = null;
      const flush = async () => { if (spec) written += await upsertBatch(pool, spec, batch); batch = []; };
      const header = (h: string[]) => { cols = uniqueIdents(h.map(toIdent)); return cols; };
      for await (const { line, row } of streamCsvObjects(file, { header, encoding: "utf8", stats })) {
        if (!spec) {
          const c = cols as unknown as string[];
          await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (src_line bigint PRIMARY KEY, ${c.map((x) => `${x} text`).join(", ")}, loaded_at timestamptz NOT NULL DEFAULT now())`);
          if (args.truncate) await pool.query(`TRUNCATE ${table}`);
          for (const x of c) if (/name|nom/.test(x)) await pool.query(`CREATE INDEX IF NOT EXISTS ${stem}_${x}_upper_idx ON ${table} (upper(trim(${x})))`);
          spec = { table, columns: ["src_line", ...c], conflict: ["src_line"] };
        }
        if (args.limit && n >= args.limit) break;
        batch.push([line, ...spec.columns.slice(1).map((c) => (row[c] === "" ? null : row[c]))]);
        n++;
        progress.tick(n);
        if (batch.length >= args.batch) await flush();
      }
      await flush();
      const seconds = progress.done(n);
      console.log(`[lobby] ${path.relative(dir, file)} → ${table}: malformed ${stats.malformed}, upserted ${written}, now ${(await countRows(pool, table)).toLocaleString()} rows`);
      await logIngest(pool, "lobby", { source: "ocl-cal open data", file: path.relative(dir, file), rows: n, seconds, note: args.limit ? `--limit ${args.limit}` : undefined });
    }
    await grantApp(pool, "lobby");
  });
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
