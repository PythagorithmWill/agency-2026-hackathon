/**
 * Loader: Elections Canada – contributions to all political entities (as
 * reviewed by Elections Canada), bulk open-data extract.
 *
 *   npx tsx scripts/ingest/elections.ts [--target local|rds] [--limit N] [--truncate] [--skip-download]
 *
 * Source (verified via CKAN 2026-09-24):
 *   dataset  ef1e3528-b570-4a42-92ef-18a9749af8f2
 *   resource c20b6312-ac5b-4a48-8298-b534e33660b9  od_cntrbtn_audt_e.zip (113,905,491 bytes,
 *            Last-Modified Sat 19 Sep 2026) → PoliticalFinance/od_cntrbtn_audt_e.csv (2,176,830,198 bytes)
 *   licence  ca-ogl-lgo (Open Government Licence – Canada)
 *
 * Natural key: src_line (the file has no contribution id and legitimately
 * repeats identical rows). Re-running on the SAME file is idempotent; a new
 * upstream snapshot must be loaded with --truncate.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  INGEST_DIR, Progress, REPO_ROOT, applyDdl, countRows, download, grantApp, logIngest, parseArgs,
  streamCsvObjects, unzip, upsertBatch, withPool,
} from "./_lib";
import { fsaOf, normName, normPostal, nz, parseDateLoose, parseMoney } from "../../src/lib/sources/normalize";

export const ELECTIONS_SOURCE = {
  datasetId: "ef1e3528-b570-4a42-92ef-18a9749af8f2",
  resourceId: "c20b6312-ac5b-4a48-8298-b534e33660b9",
  url: "https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip",
  zipBytes: 113_905_491,
  csvRelative: "PoliticalFinance/od_cntrbtn_audt_e.csv",
  licence: "ca-ogl-lgo",
};

/** Source header (2026-09 extract) → column. Exported for tests. */
export const HEADER_MAP: Record<string, string> = {
  "Political Entity": "political_entity",
  "Recipient ID": "recipient_id",
  "Recipient": "recipient",
  "Recipient last name": "recipient_last_name",
  "Recipient first name": "recipient_first_name",
  "Recipient middle initial": "recipient_middle_initial",
  "Political Party of Recipient": "recipient_party",
  "Electoral District": "electoral_district",
  "Electoral event": "electoral_event",
  "Fiscal/Election date": "fiscal_or_election_date",
  "Form ID": "form_id",
  "Financial Report": "financial_report",
  "Part Number of Return": "part_number",
  "Financial Report part": "financial_report_part",
  "Contributor type": "contributor_type",
  "Contributor name": "contributor_name",
  "Contributor last name": "contributor_last_name",
  "Contributor first name": "contributor_first_name",
  "Contributor middle initial": "contributor_middle_initial",
  "Contributor City": "contributor_city",
  "Contributor Province": "contributor_province",
  "Contributor Postal code": "contributor_postal_code",
  "Contribution Received date": "received_date",
  "Monetary amount": "monetary_amount",
  "Non-Monetary amount": "non_monetary_amount",
  "Contribution given through": "contribution_given_through",
  "Leadership contestant": "leadership_contestant",
};

const COLUMNS = [
  "src_line", "row_hash", "political_entity", "recipient_id", "recipient", "recipient_last_name", "recipient_first_name",
  "recipient_middle_initial", "recipient_party", "electoral_district", "electoral_event", "fiscal_or_election_date",
  "form_id", "financial_report", "part_number", "financial_report_part", "contributor_type", "contributor_name",
  "contributor_name_norm", "contributor_last_name", "contributor_first_name", "contributor_middle_initial",
  "contributor_city", "contributor_province", "contributor_postal_code", "contributor_fsa", "received_date",
  "monetary_amount", "non_monetary_amount", "contribution_given_through", "leadership_contestant",
] as const;

export function mapContributionRow(r: Record<string, string>, line: number): unknown[] {
  const hash = createHash("md5").update(Object.values(r).join("\u001f")).digest("hex");
  const postal = normPostal(r.contributor_postal_code);
  return [
    line, hash, nz(r.political_entity), nz(r.recipient_id), nz(r.recipient), nz(r.recipient_last_name),
    nz(r.recipient_first_name), nz(r.recipient_middle_initial), nz(r.recipient_party), nz(r.electoral_district),
    nz(r.electoral_event), parseDateLoose(r.fiscal_or_election_date), nz(r.form_id), nz(r.financial_report),
    nz(r.part_number), nz(r.financial_report_part), nz(r.contributor_type), nz(r.contributor_name),
    normName(r.contributor_name) || null, nz(r.contributor_last_name), nz(r.contributor_first_name),
    nz(r.contributor_middle_initial), nz(r.contributor_city), nz(r.contributor_province), postal || null,
    fsaOf(postal) || null, parseDateLoose(r.received_date), parseMoney(r.monetary_amount),
    parseMoney(r.non_monetary_amount), nz(r.contribution_given_through), nz(r.leadership_contestant),
  ];
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dir = path.join(INGEST_DIR, "elections");
  const zip = path.join(dir, "od_cntrbtn_audt_e.zip");
  const csv = path.join(dir, ELECTIONS_SOURCE.csvRelative);
  if (!args.skipDownload) download(ELECTIONS_SOURCE.url, zip, { expectedBytes: ELECTIONS_SOURCE.zipBytes });
  if (!existsSync(csv)) unzip(zip, dir);
  console.log(`[elections] csv ${statSync(csv).size.toLocaleString()} bytes`);

  await withPool(args, async (pool) => {
    await applyDdl(pool, path.join(REPO_ROOT, "sql", "sources", "elections.sql"), "elections");
    if (args.truncate) await pool.query("TRUNCATE elections.contributions");
    // Resume: skip lines already loaded (same file, same ordering).
    const resumeFrom = args.truncate ? 0 : await pool.query<{ m: string }>("SELECT COALESCE(max(src_line),0)::text AS m FROM elections.contributions").then((r) => Number(r.rows[0].m));
    if (resumeFrom > 0) console.log(`[elections] resuming after src_line ${resumeFrom.toLocaleString()}`);

    const spec = { table: "elections.contributions", columns: COLUMNS, conflict: ["src_line"] };
    const progress = new Progress("elections.contributions", 250_000);
    const stats = { malformed: 0 };
    let n = 0, written = 0;
    let batch: unknown[][] = [];
    const flush = async () => { written += await upsertBatch(pool, spec, batch); batch = []; };
    const header = (h: string[]) => h.map((x) => HEADER_MAP[x] ?? x.toLowerCase().replace(/\W+/g, "_"));

    for await (const { line, row } of streamCsvObjects(csv, { header, stats })) {
      if (line <= resumeFrom) continue;
      if (args.limit && n >= args.limit) break;
      batch.push(mapContributionRow(row, line));
      n++;
      progress.tick(n);
      if (batch.length >= args.batch) await flush();
    }
    await flush();
    const seconds = progress.done(n);
    console.log(`[elections.contributions] malformed ${stats.malformed}; upserted ${written}`);
    await pool.query("ANALYZE elections.contributions");
    await logIngest(pool, "elections", { source: `ckan:${ELECTIONS_SOURCE.datasetId}/${ELECTIONS_SOURCE.resourceId}`, file: ELECTIONS_SOURCE.csvRelative, rows: n, seconds, note: args.limit ? `--limit ${args.limit}` : undefined });
    console.log(`[elections.contributions] table now holds ${(await countRows(pool, "elections.contributions")).toLocaleString()} rows`);
    await grantApp(pool, "elections");
  });
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
