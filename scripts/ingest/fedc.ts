/**
 * Loader: federal Proactive Publication – Contracts over $10,000.
 *
 *   npx tsx scripts/ingest/fedc.ts [--target local|rds] [--limit N] [--truncate] [--skip-download]
 *
 * Source (verified via CKAN 2026-09-24):
 *   dataset  d8f85d91-7dec-4fd1-8055-483b77225d8b  "Proactive Publication - Contracts"
 *   resource fac950c0-00d5-4ec1-a4d3-9cbebf98a305  contracts.csv  641,558,639 bytes
 *   licence  ca-ogl-lgo (Open Government Licence – Canada)
 *   schema   https://open.canada.ca/data/recombinant-published-schema/contracts.json
 *
 * Natural key: (owner_org, reference_number) — verified unique in the file.
 * See docs/DATA-SOURCES.md for the amendment-semantics evidence.
 */
import path from "node:path";
import {
  INGEST_DIR, Progress, REPO_ROOT, applyDdl, countRows, download, grantApp, logIngest, parseArgs,
  streamCsvObjects, upsertBatch, withPool,
} from "./_lib";
import {
  fiscalYearOf, fsaOf, normName, normPostal, nz, parseDateLoose, parseIntLoose, parseMoney, parseTextArray,
} from "../../src/lib/sources/normalize";

export const FEDC_SOURCE = {
  datasetId: "d8f85d91-7dec-4fd1-8055-483b77225d8b",
  resourceId: "fac950c0-00d5-4ec1-a4d3-9cbebf98a305",
  url: "https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/fac950c0-00d5-4ec1-a4d3-9cbebf98a305/download/contracts.csv",
  expectedBytes: 641_558_639,
  licence: "ca-ogl-lgo",
};

const COLUMNS = [
  "owner_org", "reference_number", "owner_org_title", "procurement_id",
  "vendor_name", "vendor_name_norm", "vendor_postal_code", "vendor_fsa", "buyer_name",
  "contract_date", "fiscal_year", "economic_object_code", "description_en", "description_fr",
  "contract_period_start", "delivery_date", "contract_value", "original_value", "amendment_value",
  "comments_en", "comments_fr", "additional_comments_en", "additional_comments_fr",
  "agreement_type_code", "trade_agreement", "land_claims", "commodity_type", "commodity_code",
  "country_of_vendor", "solicitation_procedure", "limited_tendering_reason", "trade_agreement_exceptions",
  "indigenous_business", "indigenous_business_excluding_psib", "intellectual_property",
  "potential_commercial_exploitation", "former_public_servant", "contracting_entity", "standing_offer_number",
  "instrument_type", "ministers_office", "number_of_bids", "article_6_exceptions", "award_criteria",
  "socioeconomic_indicator", "reporting_period", "src_line",
] as const;

/** Map one CSV row (header-keyed) to the COLUMNS tuple. Exported for tests. */
export function mapContractRow(r: Record<string, string>, line: number): unknown[] {
  const contractDate = parseDateLoose(r.contract_date);
  const postal = normPostal(r.vendor_postal_code);
  return [
    nz(r.owner_org), nz(r.reference_number), nz(r.owner_org_title), nz(r.procurement_id),
    nz(r.vendor_name), normName(r.vendor_name) || null, postal || null, fsaOf(postal) || null, nz(r.buyer_name),
    contractDate, fiscalYearOf(contractDate), nz(r.economic_object_code), nz(r.description_en), nz(r.description_fr),
    parseDateLoose(r.contract_period_start), parseDateLoose(r.delivery_date),
    parseMoney(r.contract_value), parseMoney(r.original_value), parseMoney(r.amendment_value),
    nz(r.comments_en), nz(r.comments_fr), nz(r.additional_comments_en), nz(r.additional_comments_fr),
    nz(r.agreement_type_code), parseTextArray(r.trade_agreement), parseTextArray(r.land_claims),
    nz(r.commodity_type), nz(r.commodity_code), nz(r.country_of_vendor), nz(r.solicitation_procedure),
    parseTextArray(r.limited_tendering_reason), parseTextArray(r.trade_agreement_exceptions),
    nz(r.indigenous_business), nz(r.indigenous_business_excluding_psib), nz(r.intellectual_property),
    nz(r.potential_commercial_exploitation), nz(r.former_public_servant), nz(r.contracting_entity),
    nz(r.standing_offer_number), nz(r.instrument_type), nz(r.ministers_office), parseIntLoose(r.number_of_bids),
    nz(r.article_6_exceptions), nz(r.award_criteria), nz(r.socioeconomic_indicator), nz(r.reporting_period), line,
  ];
}

async function main(): Promise<void> {
  const args = parseArgs();
  const file = path.join(INGEST_DIR, "fedc", "contracts.csv");
  if (!args.skipDownload) download(FEDC_SOURCE.url, file, { expectedBytes: FEDC_SOURCE.expectedBytes });

  await withPool(args, async (pool) => {
    await applyDdl(pool, path.join(REPO_ROOT, "sql", "sources", "fedc.sql"), "fedc");
    if (args.truncate) await pool.query("TRUNCATE fedc.contracts");

    const spec = { table: "fedc.contracts", columns: COLUMNS, conflict: ["owner_org", "reference_number"] };
    const progress = new Progress("fedc.contracts");
    let n = 0, skipped = 0, written = 0;
    let batch: unknown[][] = [];
    const flush = async () => { written += await upsertBatch(pool, spec, batch); batch = []; };

    for await (const { line, row } of streamCsvObjects(file)) {
      if (args.limit && n >= args.limit) break;
      const mapped = mapContractRow(row, line);
      if (!mapped[0] || !mapped[1]) { skipped++; continue; }
      batch.push(mapped);
      n++;
      progress.tick(n);
      if (batch.length >= args.batch) await flush();
    }
    await flush();
    const seconds = progress.done(n);
    console.log(`[fedc.contracts] skipped ${skipped} rows without owner_org/reference_number; upserted ${written}`);

    await pool.query("ANALYZE fedc.contracts");
    await logIngest(pool, "fedc", { source: `ckan:${FEDC_SOURCE.datasetId}/${FEDC_SOURCE.resourceId}`, file: path.basename(file), rows: n, seconds, note: args.limit ? `--limit ${args.limit}` : undefined });
    const total = await countRows(pool, "fedc.contracts");
    console.log(`[fedc.contracts] table now holds ${total.toLocaleString()} rows`);
    await grantApp(pool, "fedc");
  });
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
