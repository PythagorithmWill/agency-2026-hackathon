# Glassbox Methodology Improvements for the Alberta Team

*2026-09-24 · Pythagorithm AI Governance Solutions · Will Coffey*

Living copy: https://claude.ai/code/artifact/dad253ef-7d80-4327-b861-b9be1e1f0147

## Summary

Pythagorithm reviewed the Alberta hackathon methodology end to end on 2026-09-24 while moving Glassbox onto its own database with a refreshed federal corpus. We found ten weaknesses, the most consequential being that the risk register and creep analysis treat cumulative amendment values as increments, which overstated growth ratios by up to two orders of magnitude. We fixed eight of them in the upstream scripts on a fork branch, behind opt-in flags so the defaults are unchanged, and implemented all of them plus the recommended extensions in Glassbox: a canonical agreement layer that cuts dashboard queries from 21 seconds to under a second, every detector match stored with an evidence-strength score and a benign-explanation note, percentile thresholds with rolling windows, hub-aware gift loops, a live data-quality scorecard, and four new federal data sources. Both branches are public and documented; the largest remaining item is re-running entity resolution over the 56,904 newly merged federal agreements, ideally after the evaluation harness has a human-labelled set.

## What we inherited

The Alberta platform ([GovAlta/agency-26-hackathon](https://github.com/GovAlta/agency-26-hackathon)) unifies four open-data sources in one Postgres database and adds a cross-dataset entity-resolution layer. Glassbox was built on it during the April 29, 2026 hackathon and still runs on it today.

| Layer | What it does | Key rules as provided |
| --- | --- | --- |
| Entity resolution (`general/`) | 851K golden records from 1.1M source records; 5.2M source links | Deterministic pass on BN root and normalised name, then a Splink Fellegi-Sunter model (Jaro-Winkler 0.92 and 0.82 on names, blocking on BN root, name, postal code, city) with an LLM review of pairs scoring 0.40 to 0.95. Link confidence is fixed per method: 0.99 BN, 0.95 exact name, 0.90 normalised, 0.88 pipe-split or trade name |
| Federal grants and contributions (`FED/`) | 1.28M rows, 51 departments, 422K recipients | `is_amendment` flag from `amendment_number`; a seven-dimension risk register capped at 5 per dimension with CRITICAL at 15 or more; zombie = last start before 2022-01-01 and $500K or more; ghost = missing BN and $500K or more; HHI concentration with 2500 as highly concentrated |
| CRA T3010 (`CRA/`) | 8.76M rows of charity filings, 2020 to 2024 | Gift loops from gifts of $5K or more, 2 to 6 hops, year spread of at most 1; Tarjan strongly-connected components (347, largest 8,971 nodes); ten arithmetic-identity checks with a $1 tolerance; donee-name quality classes worth $8.97B, 13.4% of gift dollars |
| Alberta (`AB/`) | 2.6M rows of grants, contracts, sole-source and non-profit registry | Repeat sole-source vendors at 3 or more contracts; contract splitting at 3 or more to one vendor in one year over $100K; program HHI over 2500 |
| Data-issue register | 40 catalogued issues across F (federal), C (CRA) and A (Alberta) | Documents running-total amendment values (F-3), ref-number collisions across recipients (F-1), placeholder business numbers (F-6, F-7), and Alberta duplicate and reversal rows (A-13, A-6, A-10) |

The register is the strongest part of the package. The weaknesses below are mostly cases where the analysis scripts do not yet apply what the register documents.

## Weaknesses found, with evidence

Every item was measured on the organizers' 2026-04-21 export during an end-to-end review of Glassbox on 2026-09-24.

| # | Weakness | Evidence | Effect |
| --- | --- | --- | --- |
| 1 | Amendment rows carry running totals, but the risk register and amendment-creep script sum them as deltas | Agreement `001-2020-2021-Q1-00006`: original 20.54M, amendments 36.24M, 36.24M, 36.24M. Delta arithmetic reports 6.29x growth (20.56M to 129.28M); the true figure is 1.76x | Every growth ratio and the amendment dimension of the risk register are overstated; top creep result was reported as 286x |
| 2 | Grouping by `ref_number` alone mixes recipients (F-1) | The same ref also carries a $23,755 row for a different recipient; the naive chain shows five rows from two organisations | Purpose-drift and creep matches attributed to the wrong recipient |
| 3 | Placeholder business numbers escape the ghost detector | `recipient_business_number` holds "0" on 18,522 rows, "000000000" on 2,741, "-" on 894, "n/a" on 403 and "none" on 64; the script treats only NULL and empty string as missing | Ghost-capacity undercounts and detector links resolve to a placeholder identifier |
| 4 | Recipient totals differ by page | Recipient pages summed original rows ($713.3M for BN 108162330) while the overview used current values ($737.7M) | The same entity showed two different totals |
| 5 | Fixed-date cutoffs | Zombie rule hard-codes 2022-01-01 | The definition drifts as the corpus ages |
| 6 | Absolute dollar thresholds | $500K, $1M, $5M, $1B applied regardless of program size | A $600K recipient in a $2M program scores the same as one in a $2B program |
| 7 | Loop detection misses hub-routed cycles | Partitioned Johnson run finds about 60% of cycles; the listed false positives (donor-advised-fund platforms, federated charities, denominational hierarchies) are exactly the hubs it cannot route through | Both recall and precision suffer where it matters most |
| 8 | Entity-resolution confidence is assigned, not measured | Fixed values per method (0.99, 0.95, 0.90, 0.88); coverage checked on a 500-entity sample; 65K pairs the LLM labelled RELATED are discarded | No precision or recall figure exists; a ready-made related-parties edge set goes unused |
| 9 | Datastore ids are renumbered on every government re-upload | Loaded rows carry `_id` 364.6M to 365.9M; the 2026-09-24 feed carries 489M and up; `entity_source_links` references rows by `_id` | The upstream `ON CONFLICT (_id)` import would duplicate the corpus on refresh, and a full replace would orphan 1.27M entity links |
| 10 | Attribution gap | The term TRACE does not appear in the upstream repository, and the loop-score attention threshold of 12 has no upstream source | Glassbox's provenance labels overstated what came from the Ministry |

## Fixes applied to the upstream scripts

All eight changes live on the fork branch [PythagorithmWill/agency-26-hackathon, branch `pythagorithm/methodology-improvements`](https://github.com/PythagorithmWill/agency-26-hackathon/tree/pythagorithm/methodology-improvements). Default behaviour is unchanged unless noted; new behaviour is behind environment flags. Numbers were measured on a local copy of the 2026-04-21 export. FED, CRA and general test suites pass (37, 191 and 14 tests).

| Fix | Files | Before | After |
| --- | --- | --- | --- |
| Amendment growth = latest amendment row ÷ amendment-0 row, per F-1 key | `FED/lib/quality-columns.js` (`amendmentChainSql`), `FED/scripts/advanced/03-amendment-creep.js`, `07-risk-register.js` | In-Sec-M reported 13,705% growth; 368 entities scoring 10+ carried AMENDMENTS_DWARF_ORIGINAL | 6,270%; 12 entities. Bands CRITICAL 627→592, HIGH 5,848→5,649, MEDIUM 8,556→8,091. Also fixed a GROUP BY error on Postgres 15 |
| Placeholder BNs normalised to NULL in `recipient_bn_normalized` / `recipient_bn_root`; raw column untouched | `FED/scripts/06-fix-quality.js`, `05-zombie-and-ghost.js` | Rows with no usable BN 703,108 | 725,784 (22,676 placeholders). Ghost entities over $500K 38,383→39,025 |
| Duplicate-row flag `is_duplicate_row` (F-2) | `06-fix-quality.js` + touched analysis scripts | Not tracked | 0 true duplicates under the strict key; 2,590 rows in 1,293 groups differ only by publisher, flagged with `FED_DUP_IGNORE_OWNER_ORG=1` |
| Rolling windows anchored on the latest non-future start date | `05-zombie-and-ghost.js` (`ZOMBIE_WINDOW_MONTHS` 36, `DISAPPEARED_WINDOW_MONTHS` 60) | Fixed cutoff 2022-01-01: 23,851 zombies | Cutoff 2023-05-28: 30,312; disappeared for-profits 460→958 |
| Relative thresholds, opt-in `RELATIVE_THRESHOLDS=1` | `07-risk-register.js` | 592 / 5,649 / 8,091 | 483 / 6,419 / 8,076 |
| Hub-aware gift loops, opt-in `HUB_AWARE=1` | `CRA/scripts/advanced/01-detect-all-loops.js`, `*_ha` tables | 5,808 loops, 97% through a hub (CanadaHelps degree 14,868) | 3,143 temporal instances on 2,239 paths; 111 paths with no hub; 10.5 s for 2–6 hops |
| Entity-resolution evaluation harness + RELATED-edge export | `general/scripts/eval-resolution.js`, `export-related-edges.js`, `lib/eval-metrics.js`, `eval/seed-labels.csv` | No measured precision or recall | Harness ready; 200-pair seed set (20 heuristic labels, needs human review); 64,756 RELATED pairs exported |
| Documentation | `CHANGELOG-PYTHAGORITHM.md`, `docs/METHODOLOGY-NOTES.md`, READMEs, `KNOWN-DATA-ISSUES.md` notes | | |

Two findings for the team: 195,702 amendment-only keys have no amendment-0 row (190,978 predate the dataset; 4,724 are name or BN drift), and the name-plus-postal-code heuristic needed a BN-root guard because two distinct Knox Presbyterian congregations share a head-office postal code.

## Improvements implemented in Glassbox

Branch `methodology-v2` of [PythagorithmWill/agency-2026-hackathon](https://github.com/PythagorithmWill/agency-2026-hackathon/tree/methodology-v2), running on a Pythagorithm-owned Postgres with the full Alberta export plus a merged federal refresh (1,332,425 federal rows as of 2026-09-24). Every new table lives in a separate `app` schema; the upstream schemas are never modified, and the code falls back to the original query paths when `app` is absent.

- **Canonical layer.** `app.agreement_current` (one row per F-1 key) plus recipient, department, program, fiscal-year and province rollups. Results are byte-identical to the previous CTE path. Overview 21,461→504 ms; top departments 9,936→2 ms; temporal series 8,952→2 ms; recipient totals 10,690→2,488 ms; department profile 5,666→3 ms.
- **Detector output as data.** `app.pattern_matches` stores every match from all nine detectors (57,095 rows vs 50 per pattern before) with severity, signal, evidence, department, province and fiscal year; pages and the API page through it with filters.
- **Evidence strength and benign notes.** Strength = clamp(base × Π(1−penalty)), base = 0.5 + 0.5·(1−e^−margin). Penalties: placeholder/missing BN 0.30, name-only 0.20, duplicate rows 0.25, negative values 0.25, ref collision 0.20, hub touched 0.35, single recipient 0.30, low golden confidence 0.15, peer group under 10 0.20, unit error 0.40, unregistered donee 0.20. See `src/lib/patterns/strength.ts`.
- **Relative thresholds and rolling windows.** p90 within department/program/entity type alongside the documented floors; 36-month windows (5 years for policy) from the latest non-future agreement date.
- **Observations behind each flag.** Every match card shows its cited fields; amendment-purpose drift shows the initial and current descriptions side by side with the keywords that disappeared and appeared.
- **Related parties** from the 64,756 LLM-labelled RELATED pairs. **Hub-aware gift loops** in `app.gift_loops` (13,477 hubs never interior; temporal ordering; weighted edges; 9,392 loops).
- **Data-quality scorecard** at `/transparency/data-quality`: 35 register issues recomputed per refresh (e.g. F-3 over-count $104.7B, A-13 duplicates $52.3B).
- **Attribution** corrected on the trace and methodology pages with a provenance column per pattern.
- **New data sources:** federal contracts over $10K (`fedc`, 1,313,272 rows), Elections Canada contributions (`elections`, 6,262,427), Corporations Canada (`corp`, 1,568,531); lobbying registry schema and loader (`lobby`; bulk download requires a manual fetch). See `docs/DATA-SOURCES.md`.

## How to use the shared branches

| What | Where | How |
| --- | --- | --- |
| Upstream script fixes | fork branch `pythagorithm/methodology-improvements` | `cd FED && npm run fix-quality`, then the analysis scripts. Flags: `RELATIVE_THRESHOLDS=1`, `HUB_AWARE=1`, `ZOMBIE_WINDOW_MONTHS`, `FED_DUP_IGNORE_OWNER_ORG=1`. Harness: `cd general && node scripts/eval-resolution.js --sample 500`, label, then `--score labelled.csv`. Pull requests against GovAlta/agency-26-hackathon on request. |
| Glassbox v2 pipeline | branch `methodology-v2` | Point `DATABASE_URL` at any copy of the database; optionally `psql -f sql/migrations/001_canonical.sql`, `npx tsx scripts/refresh-derived.ts`, `npx tsx scripts/refresh-loops.ts` (about 22 minutes on 2 vCPUs); then `scripts/build-snapshot.ts` and `npm run dev`. See `docs/METHODOLOGY-V2.md`, `docs/DATA-SOURCES.md`, `infra/aws/DATABASE.md`. |

Live deployment: https://glassbox.pythagorithm.ai

## Open items

- Entity resolution has not been re-run over the 56,904 merged federal rows; they resolve by BN or name but have no golden records or source links. Use the evaluation harness first for a measured baseline.
- `general/eval/seed-labels.csv` needs human labelling before precision and recall mean anything.
- Ghost-capacity output is capped at 20,000 matches on the production database (`pattern_runs.cap_hit = true`).
- Lobbying registry download is blocked by bot protection; fetch the two zips manually into `data/ingest/lobby/`.
- Alberta and CRA refreshes are manual and need the same natural-key merge treatment as the federal feed.
- 195,702 amendment-only chains lack an original row; reported, not repaired.
- Creep and duplicative-funding are lifetime measures; fiscal year is stored on every match for consumer-side windowing.
- Audit outcomes as labels and other provinces' disclosures are not started.
- Any future entity-resolution run should link federal rows by the natural agreement key, not `_id`, which is renumbered on every government re-upload.
