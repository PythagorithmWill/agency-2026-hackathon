/**
 * Loader: Corporations Canada – Federal Corporations (ISED open dataset).
 *
 *   npx tsx scripts/ingest/corp.ts [--target local|rds] [--limit N] [--truncate] [--skip-download]
 *
 * Source (verified via CKAN + HTTP HEAD 2026-09-24):
 *   dataset 0032ce54-c5dd-4b66-99a0-320a7b5e99f2, four English CSVs on d4bf66bykfyaf.cloudfront.net
 *   licence ca-ogl-lgo (Open Government Licence – Canada)
 *
 * Natural key: corporation_number. Directors are not in the bulk files (only
 * min/max director counts) — see corp.directors in sql/sources/corp.sql.
 */
import path from "node:path";
import {
  INGEST_DIR, Progress, REPO_ROOT, applyDdl, countRows, download, grantApp, logIngest, parseArgs,
  streamCsvObjects, upsertBatch, withPool,
} from "./_lib";
import { fsaOf, normBn, normName, normPostal, nz, parseDateLoose, parseIntLoose } from "../../src/lib/sources/normalize";

export const CORP_SOURCE = {
  datasetId: "0032ce54-c5dd-4b66-99a0-320a7b5e99f2",
  licence: "ca-ogl-lgo",
  files: [
    { resourceId: "7b6dd154-aa04-46ce-8880-ce4a5fa0a680", name: "corporations-active-cbca-en.csv", bytes: 103_618_547 },
    { resourceId: "eb1a8f01-b85b-4190-9aa7-65dde7c623b9", name: "corporations-active-non-cbca-en.csv", bytes: 9_194_001 },
    { resourceId: "95b36c01-e21b-4a8a-8bdf-0c128928dc27", name: "corporations-inactive-or-dissolved-cbca-en.csv", bytes: 157_181_480 },
    { resourceId: "e9f89fec-428d-4a30-a9e8-fc8e42d91bf6", name: "corporations-inactive-or-dissolved-non-cbca-en.csv", bytes: 8_525_251 },
  ],
  baseUrl: "https://d4bf66bykfyaf.cloudfront.net/",
};

export const HEADER_MAP: Record<string, string> = {
  "Corporation number": "corporation_number",
  "Business number (BN)": "business_number",
  "Corporate name - form 1": "name_form1",
  "Corporate name - form 2": "name_form2",
  "Governing legislation": "governing_legislation",
  "Status": "status",
  "Status Detail": "status_detail",
  "Anniversary date": "anniversary_date",
  "Year of last annual filing": "year_of_last_annual_filing",
  "Date of last annual meeting": "date_of_last_annual_meeting",
  "Street": "street",
  "Street 2": "street2",
  "City/town": "city",
  "Province/territory": "province",
  "Country": "country",
  "Postal code": "postal_code",
  "Minimum number of directors": "min_directors",
  "Maximum number of directors": "max_directors",
};

const COLUMNS = [
  "corporation_number", "business_number", "name_form1", "name_form2", "name_norm", "governing_legislation",
  "status", "status_detail", "anniversary_date", "year_of_last_annual_filing", "date_of_last_annual_meeting",
  "street", "street2", "city", "province", "country", "postal_code", "fsa", "min_directors", "max_directors", "source_file",
] as const;

export function mapCorporationRow(r: Record<string, string>, sourceFile: string): unknown[] {
  const postal = normPostal(r.postal_code);
  return [
    nz(r.corporation_number), normBn(r.business_number) || null, nz(r.name_form1), nz(r.name_form2),
    normName(r.name_form1) || null, nz(r.governing_legislation), nz(r.status), nz(r.status_detail),
    parseDateLoose(r.anniversary_date), parseIntLoose(r.year_of_last_annual_filing), parseDateLoose(r.date_of_last_annual_meeting),
    nz(r.street), nz(r.street2), nz(r.city), nz(r.province), nz(r.country), postal || null, fsaOf(postal) || null,
    parseIntLoose(r.min_directors), parseIntLoose(r.max_directors), sourceFile,
  ];
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dir = path.join(INGEST_DIR, "corp");
  if (!args.skipDownload) for (const f of CORP_SOURCE.files) download(CORP_SOURCE.baseUrl + f.name, path.join(dir, f.name), { expectedBytes: f.bytes });

  await withPool(args, async (pool) => {
    await applyDdl(pool, path.join(REPO_ROOT, "sql", "sources", "corp.sql"), "corp");
    if (args.truncate) await pool.query("TRUNCATE corp.corporations CASCADE");
    const spec = { table: "corp.corporations", columns: COLUMNS, conflict: ["corporation_number"] };
    const header = (h: string[]) => h.map((x) => HEADER_MAP[x] ?? x.toLowerCase().replace(/\W+/g, "_"));
    let grand = 0;
    for (const f of CORP_SOURCE.files) {
      const file = path.join(dir, f.name);
      const progress = new Progress(`corp:${f.name}`, 100_000);
      const stats = { malformed: 0 };
      let n = 0, skipped = 0, written = 0;
      let batch: unknown[][] = [];
      const flush = async () => { written += await upsertBatch(pool, spec, batch); batch = []; };
      for await (const { row } of streamCsvObjects(file, { header, stats })) {
        if (args.limit && n >= args.limit) break;
        const mapped = mapCorporationRow(row, f.name);
        if (!mapped[0]) { skipped++; continue; }
        batch.push(mapped);
        n++;
        progress.tick(n);
        if (batch.length >= args.batch) await flush();
      }
      await flush();
      const seconds = progress.done(n);
      grand += n;
      console.log(`[corp] ${f.name}: malformed ${stats.malformed}, skipped ${skipped}, upserted ${written}`);
      await logIngest(pool, "corp", { source: `ckan:${CORP_SOURCE.datasetId}/${f.resourceId}`, file: f.name, rows: n, seconds, note: args.limit ? `--limit ${args.limit}` : undefined });
    }
    await pool.query("ANALYZE corp.corporations");
    console.log(`[corp.corporations] loaded ${grand.toLocaleString()} this run; table now holds ${(await countRows(pool, "corp.corporations")).toLocaleString()} rows`);
    await grantApp(pool, "corp");
  });
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
