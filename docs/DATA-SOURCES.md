# Glassbox external data sources

Status as of 2026-09-24 (branch `methodology-v2`). These four sources extend
the detectors beyond the CRA/federal-grants/Alberta corpus: federal contracts
(sole-source creep, vendor concentration), the Registry of Lobbyists,
Elections Canada contributions and Corporations Canada (related-parties edges).

All raw downloads live under `data/ingest/<source>/` (git-ignored). Each source
has its own Postgres schema, an idempotent DDL in `sql/sources/<source>.sql`, a
resumable streaming loader `scripts/ingest/<source>.ts`, typed query helpers in
`src/lib/sources/<source>.ts` (every helper feature-detects the schema with
`to_regclass` and returns `{ available:false, rows:[] }` where the source is not
loaded), and an `<schema>.ingest_log` provenance table.

```
npm run ingest:fedc      -- [--target local|rds] [--limit N] [--truncate] [--skip-download]
npm run ingest:elections
npm run ingest:corp
npm run ingest:lobby     -- needs the zips placed by hand, see below
npx tsx scripts/ingest/sync-rds.ts <schema.table> [--truncate] [--where "<sql>"]
```

Load order that was used: local `postgresql://localhost:5432/agency26` first
(full writable copy, verified against source metadata), then RDS. On RDS the
loader only ever touches its own schema (`fedc`, `lobby`, `elections`, `corp`),
checks that no `INSERT INTO fed.grants…` is active before writing, and grants
`USAGE`/`SELECT` to `glassbox_app` when that role exists. On 2026-09-24 the first
smoke loads ran while RDS had no `glassbox_app` role (the grant step logged
and skipped); the role existed by the time the full syncs ran and
`has_schema_privilege('glassbox_app', s, 'USAGE')` is true for `fedc`,
`elections` and `corp`, with SELECT on every table and view. `sync-rds.ts` pipes `psql \copy` from local to RDS,
which measured 2,660 rows/s versus ~800 rows/s for batched INSERTs on the
conference link, so it is the preferred way to publish a table to RDS after a
local load. Quirk seen on the 6.26 M-row elections sync: after ~35 min the
psql client lost its connection *after* the INSERT had committed; the script
now checks the row count and still runs ANALYZE/grants/log when rows arrived
(the elections grant was applied by hand that time; `ingest_log` says so).

Shared parsing lives in `src/lib/sources/csv.ts` (streaming RFC-4180 parser,
no dependency; `csv-parse` is not in `node_modules`) and
`src/lib/sources/normalize.ts` (name/postal-code/money/date/fiscal-year
normalisers). Both are unit-tested in `src/lib/sources/__tests__/`.

---

## 1. Federal contracts — `fedc.contracts`

| | |
|---|---|
| Portal | open.canada.ca, "Proactive Publication – Contracts" |
| Dataset | `d8f85d91-7dec-4fd1-8055-483b77225d8b` |
| Resource | `fac950c0-00d5-4ec1-a4d3-9cbebf98a305` — `contracts.csv`, consolidated, **641,558,639 bytes**, last modified 2026-09-24T06:51Z (refreshed nightly from the recombinant datastore) |
| Schema | `https://open.canada.ca/data/recombinant-published-schema/contracts.json` (43 fields; choice codes for `instrument_type`, `solicitation_procedure`, `limited_tendering_reason`, `commodity_type`, `agreement_type_code`, `award_criteria`, `trade_agreement`) |
| Licence | Open Government Licence – Canada (`ca-ogl-lgo`) |
| Refresh | Departments publish quarterly (`reporting_period` = `YYYY-YYYY-Qn`); the CSV is rebuilt daily. Re-run the loader; upsert on the natural key. |
| Natural key | `(owner_org, reference_number)` — verified 0 duplicates in the first 350,000 rows and enforced as the primary key on load |
| Row counts | local: **1,313,272** (equals the record count of an independent Python `csv` pass; 99 `owner_org`s; 244,117 sole-source rows; 213,124 amendment rows; 1,100,234 distinct procurements) · RDS: **1,313,272** (equal; COPY sync 111 s for 738 MB once the uplink recovered — a second queued run was a +0 no-op, both in `fedc.ingest_log`) |
| Runtime | local full load 136.3 s (≈9,600 rows/s, 2,000-row batches). Download from open.canada.ca ran at 12–40 KB/s for most of the session (≈30 min for 641 MB); the loader resumes with `curl -C -`. |

Column mapping is 1:1 with the schema plus derived `vendor_name_norm`
(`upper(trim())`, whitespace collapsed), `vendor_postal_code` (A1A1A1),
`vendor_fsa`, `fiscal_year` (Apr–Mar from `contract_date`), and the generated
flags `is_amendment` and `is_sole_source` (`solicitation_procedure = 'TN'`,
"Non-Competitive"). `_text` fields (`trade_agreement`, `land_claims`,
`limited_tendering_reason`, `trade_agreement_exceptions`) are stored as `text[]`.

Indexes: `vendor_name_norm`, `upper(trim(vendor_name))`, `vendor_postal_code`,
`vendor_fsa`, `(owner_org, procurement_id)`, `contract_date`,
`(fiscal_year, owner_org)`, `solicitation_procedure`, `commodity_code`.

### Amendment semantics (evidence)

Analysed on the full 2026-09-24 file (1,313,272 records; the file has
1,386,539 physical lines because comment fields contain newlines):

* `instrument_type`: `C` 684,066 · `A` 204,629 · `SOSA` 69,985 · blank 354,592
  (pre-2020 rows predate the field). `solicitation_procedure`: `TC` 417,896 ·
  `TN` 244,117 · `OB` 166,156 · `ST` 31,893 · `AC` 11,185 · blank 442,025.
* `(owner_org, reference_number)` is unique across all 1,313,272 records.
* Amendments are **separate rows** sharing `procurement_id` with the original.
  On an `A` row, `contract_value` is the **cumulative total to date** and
  `amendment_value` is **that amendment's delta**. Example
  (`casdo-ocena`, `P2200019`): `contract_value` 96,546.86 → 131,826.92 →
  187,460.47 → 200,682.60 while `amendment_value` is 65,991.63 / 24,012.50 /
  55,633.55 / 13,222.13 and `original_value` stays 23,226.73 — successive
  differences of `contract_value` equal the `amendment_value` deltas.
* Across 1,087,185 procurement groups, 767,038 rows satisfy `contract_value =
  original_value + amendment_value` exactly (the single-row / first-amendment
  shape). Among the 37,361 procurements with ≥2 `A` rows: **21,789 (58%)
  reconcile as deltas** (`last contract_value = original + Σ amendment_value`),
  3,848 (10%) only reconcile if `amendment_value` were cumulative (`last =
  original + last amendment_value`), and 11,724 (31%) reconcile neither way
  (departmental data-quality noise: restated originals, missing rows, an `A`
  row whose cumulative value does not carry forward). The earlier 350k-row
  sample gave the same proportions (632 / 103 / 591).
* Consequence (same as the F-3 grants lesson): **never `SUM(contract_value)`
  across rows** — that double-counts every amendment. The current value of a
  procurement is the `contract_value` of its latest row. `fedc.contracts_current`
  encodes this with `DISTINCT ON (owner_org, COALESCE(procurement_id,
  reference_number)) … ORDER BY reporting_period DESC, contract_date DESC`.
  Amendment growth = `current_value / original_value` from that view.

### Helpers (`src/lib/sources/fedc.ts`)

* `contractsByVendor(name, { fuzzy?, limit? })` — current-value rows per procurement.
* `soleSourceShareByDepartment(fy, { minContracts? })` — count and value share of `TN` per `owner_org`.
* `vendorConcentrationByDepartment(fy, { minVendors? })` — top-vendor share and HHI of current value.
* `amendmentGrowthByVendor(name, { minRatio?, limit? })` — procurements whose current value ≥ ratio × original.

Measured on the full local table: `contractsByVendor` (exact) 235 ms,
`soleSourceShareByDepartment` 617 ms (79 departments for 2023-24),
`vendorConcentrationByDepartment` 483 ms, `amendmentGrowthByVendor` 82 ms —
all inside the 8 s request-path pool timeout. `{ fuzzy:true }` is a
sequential scan (≈2.2 s); use it from precompute paths only.

Known quirks: `vendor_postal_code` and `buyer_name` are sparsely populated
before 2020; `number_of_bids` is blank for most rows; `vendor_name` spelling
varies across departments (use `nameKey()` for fuzzy joins).

---

## 2. Registry of Lobbyists — `lobby.*` (BLOCKED, loader ready)

| | |
|---|---|
| Portal | open.canada.ca organisation `ocl-cal`; files hosted on lobbycanada.gc.ca |
| Datasets | `70ef2117-1095-4d77-80eb-b87f2bada2a4` Lobbying Registrations — resource `ab35c449-ef35-40cf-bf96-0b0589c1eba5` `registrations_enregistrements_ocl_cal.zip`, dictionary `fe95e450-…` (xlsx)<br>`a34eb330-7136-4f5e-9f5f-3ba41df58b06` Monthly Communication Reports — resource `fb2843fb-f5a7-4e4c-92ea-004e65313fe9` `communications_ocl_cal.zip`, dictionary `4c698020-…` (xlsx) |
| Licence | **`ca-odla-aldg` — Open Data Licence Agreement, Office of the Commissioner of Lobbying** (not OGL-Canada; attribution terms differ) |
| Metadata modified | 2026-09-21 |
| Refresh | OCL republishes the exports monthly |
| Row counts | none loaded |

**Blocker (verified 2026-09-24):** `lobbycanada.gc.ca/media/...zip` and the
XLSX dictionaries return HTTP 403 with a Cloudflare JavaScript challenge to
every non-browser client (default and Chrome user agents, with Accept headers).
The loader does not attempt to defeat that. Next step: download the two zips in
a browser from the dataset pages above into `data/ingest/lobby/`, then
`npm run ingest:lobby -- --skip-download`. Because the dictionaries could not be
read, `scripts/ingest/lobby.ts` is header-driven: one all-text table per CSV
(`lobby.<file stem>`, `src_line` key, `upper(trim())` index on every
`*name*`/`*nom*` column). After the first load, inspect the tables and create
the typed view `lobby.registrations_v` (`registration_number, client_name,
registrant_name, registration_type, effective_date, end_date, subject_matters,
institutions`) that `lobbyingByClient()` / `lobbyingByRegistrant()` in
`src/lib/sources/lobby.ts` read; until then they return `available:false`.

---

## 3. Elections Canada contributions — `elections.contributions`

| | |
|---|---|
| Portal | open.canada.ca "Contribution to all political entities, as reviewed by Elections Canada" |
| Dataset | `ef1e3528-b570-4a42-92ef-18a9749af8f2` |
| Resource | `c20b6312-ac5b-4a48-8298-b534e33660b9` — `https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip`, **113,905,491 bytes**, Last-Modified Sat 19 Sep 2026 08:30 GMT → `PoliticalFinance/od_cntrbtn_audt_e.csv`, **2,176,830,198 bytes**, 27 columns, CRLF, amounts space-padded (`"         2500.00"`) |
| Licence | Open Government Licence – Canada (`ca-ogl-lgo`) |
| Refresh | Elections Canada regenerates the zip weekly (zip banner: "created at 2026-09-19 4:26:26 AM"). Ordering may change between snapshots → reload with `--truncate`. |
| Natural key | `src_line` (line number in the published file). The file carries no contribution id and identical rows are legitimate; `row_hash` (md5 of the raw row) is stored for drift checks. The loader resumes from `max(src_line)`. |
| Row counts | local: **6,262,427** (= 6,262,428 file lines − header, exact) · RDS: **6,262,427** (equal) |
| Runtime | local full load 650.7 s (≈9,600 rows/s, 2,000-row batches) after a 5,000-row smoke; RDS COPY sync ≈35 min for the 6.26 M rows (single psql pipe, ≈1 MB/s uplink) |

Columns follow the source header (`political_entity`, `recipient_id`,
`recipient`, `recipient_party`, `electoral_district`, `electoral_event`,
`fiscal_or_election_date`, `form_id`, `financial_report`, `part_number`,
`contributor_type`, `contributor_name`, `contributor_last_name`,
`contributor_first_name`, `contributor_city`, `contributor_province`,
`contributor_postal_code`, `received_date`, `monetary_amount`,
`non_monetary_amount`, `contribution_given_through`, `leadership_contestant`)
plus `contributor_name_norm`, normalised postal code and `contributor_fsa`.
Indexes on name (norm and `upper(trim())`), postal code, FSA, recipient,
party, date, `(upper(last), upper(first))`.

Known quirks: individuals are written `"LAST, FIRST"` upper-case; contributions
"received prior to January 1, 2004" have no `received_date` (31,795 rows);
41,156 rows are exact duplicates of another row (legitimate repeat gifts —
hence the line-number key); 37 rows carry a future `received_date` (max
2051-01-04, a source typo); city spelling is free text (`Shebrooke`). Entity
mix: registered parties 5,039,117 · associations 572,543 · leadership
contestants 494,789 · candidates 140,837 · nomination contestants 15,141.
Monetary total ≈ $1.263 B.

Helpers (`src/lib/sources/elections.ts`): `contributionsByName(name, { postalCode?, limit? })`
(tries `FIRST LAST` and `LAST, FIRST` forms via `nameVariants()`),
`contributionsByPostalCode(postal)`, `contributionSummaryByName(name)` (per-party totals).

---

## 4. Corporations Canada — `corp.corporations`, `corp.directors`

| | |
|---|---|
| Portal | open.canada.ca "Federal Corporations" (ISED, org `ic`) |
| Dataset | `0032ce54-c5dd-4b66-99a0-320a7b5e99f2`, metadata modified 2026-09-24 |
| Resources (EN) | `7b6dd154-aa04-46ce-8880-ce4a5fa0a680` active CBCA — 103,618,547 B<br>`eb1a8f01-b85b-4190-9aa7-65dde7c623b9` active non-CBCA — 9,194,001 B<br>`95b36c01-e21b-4a8a-8bdf-0c128928dc27` inactive/dissolved CBCA — 157,181,480 B<br>`e9f89fec-428d-4a30-a9e8-fc8e42d91bf6` inactive/dissolved non-CBCA — 8,525,251 B<br>all Last-Modified 2026-09-24 11:06 UTC on `d4bf66bykfyaf.cloudfront.net` (French mirrors exist) |
| Licence | Open Government Licence – Canada (`ca-ogl-lgo`) |
| Refresh | Daily rebuild. Upsert on `corporation_number`; `source_file` records which file a row came from (a corporation that dissolves moves files). |
| Natural key | `corporation_number` |
| Row counts | local: **1,568,531** = 645,102 + 51,107 + 829,749 + 42,573, each equal to its file's line count − header · RDS: **1,568,531** (equal) |
| Runtime | local full load ≈55 s for all four files (≈30,000 rows/s); RDS COPY sync 442.6 s for 395 MB (≈3,300 rows/s); `glassbox_app` granted USAGE/SELECT on `corp` |

18 columns: corporation number, business number (kept as 9-digit BN or NULL —
about 98% populated for active CBCA, ~33% for dissolved), two name forms,
governing legislation (CBCA, CNCA, Boards of Trade Act, Canada Corporations
Act…), status/status detail, anniversary date, year of last annual filing, date
of last annual meeting, address, min/max directors. Indexes on both name forms,
BN, postal code, FSA, status.

**Directors are not in the bulk dataset** — only the minimum/maximum number of
directors. `corp.directors` (created by the DDL) is the landing table for a
per-corporation fetch from the Corporations Canada online database
(`https://ised-isde.canada.ca/cc/lgcy/fdrlCrpDtls.html?corpId=<number>`), which
is a follow-up loader. Until it is populated `directorsByPerson()` and
`directorsOfCorporation()` return `available:false`.

Helpers (`src/lib/sources/corp.ts`): `corporationsByNameOrBn(nameOrBn)` (BN auto-detected),
`corporationsByPostalCode(postal, { activeOnly? })` (shared-address signal),
`directorsByPerson(name)`, `directorsOfCorporation(number)`.

---

## Attribution

Federal contracts, Elections Canada and Corporations Canada data: "Contains
information licensed under the Open Government Licence – Canada"
(https://open.canada.ca/en/open-government-licence-canada). Registry of
Lobbyists data, when loaded, is subject to the Office of the Commissioner of
Lobbying Open Data Licence Agreement
(https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/).
