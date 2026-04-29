# agency2026-data-skill

The schema, the join keys, the data quality landmines, and the canonical SQL patterns for the Agency 2026 corpus. Invoked by PYTH-DATA on every query construction.

## The four schemas

| Schema | What it is | Volume |
|---|---|---|
| `general` | Cross-dataset entity resolution | ~851K golden records |
| `cra` | T3010 charity filings, 2020–2024 | ~8.6M rows |
| `fed` | Federal grants & contributions, 2006–2025 | ~1.275M rows |
| `ab` | Alberta open data: grants, contracts, sole-source, non-profit | ~2.57M rows |

## The starting point

```sql
SELECT
  id,                       -- primary key (NOT entity_id)
  canonical_name,
  bn_root,                  -- 9-digit Canadian Business Number root
  bn_variants,              -- JSONB array
  aliases,                  -- JSONB array
  dataset_sources,          -- TEXT[] e.g. {'cra','fed','ab'}
  cra_profile,              -- JSONB
  fed_profile,              -- JSONB
  ab_profile,               -- JSONB
  addresses                 -- JSONB array
FROM general.entity_golden_records
WHERE bn_root = $1
LIMIT 1;
```

**Always anchor on BN where available.** Name-based joins are probabilistic; BN is authoritative.

## Schema reality (locked)

| Documented | Actual |
|---|---|
| `general.golden_records` | `general.entity_golden_records` |
| `general.entity_golden_records.entity_id` | `general.entity_golden_records.id` |
| `general.entity_loops` | `cra.loops` (5,808) |
| `cra.t3010_violations` | `cra.t3010_impossibilities` (54,010) + `cra.t3010_plausibility_flags` (1,075) |
| `fed.vw_agreement_current` | does not exist; use F-3 CTE pattern |
| `cra.loop_universe` keyed by `loop_id` | keyed by `bn` with pre-aggregated `score`, `total_loops` |

## The data quality landmines

### F-1 — `ref_number` collisions across distinct recipients
~41K rows where the same `ref_number` covers multiple unrelated recipients. Partition by `(ref_number, COALESCE(bn, legal_name, _id::text))` so colliding agreements stay separated.

### F-3 — `agreement_value` is cumulative
Each amendment row restates the running total. Naive `SUM` triple-counts. **Canonical CTE pattern:**

```sql
WITH agreement_current AS (
  SELECT DISTINCT ON (
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text)
  )
    _id, ref_number, recipient_legal_name, recipient_business_number,
    agreement_value, agreement_start_date, prog_name_en, owner_org_title,
    description_en
  FROM fed.grants_contributions
  ORDER BY
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text),
    NULLIF(amendment_number, '')::int DESC NULLS LAST,
    _id DESC
)
SELECT * FROM agreement_current ...
```

### A-13 — AB exact duplicates + reversal pairs
5,557 excess exact-duplicates and 951 reversal pairs in FY 2024-25 + 2025-26. Dedupe on `(ministry, business_unit_name, recipient, program, amount, payment_date)`.

### A-10 — AB roll-up rows
`recipient IS NULL` rows are publisher-aggregated programs (~$25B). Filter `recipient IS NOT NULL` for recipient-level analysis; surface the omitted aggregate elsewhere.

### A-6 — AB negative amounts
50,381 negative rows totalling -$13.11B are reversals/corrections, not errors.

### F-6 / F-7 — BN format polyglot
4% of for-profit recipients have no BN. Use `general.extract_bn_root()` to normalize.

### C-7 — CRA name history is mostly missing
Only 1.4% of CRA BNs show historical name change. CRA appears to backfill current legal names onto historical years. Treat `cra_identification.legal_name` as current-state, not historical.

## Year alignment convention

Apr 1 – Mar 31, labeled by **end year**. AB `"2023 - 2024"` → label **2024**. FED `agreement_start_date` 2023-10-01 → label **2024** (start month >= April → +1). CRA `fpe = 2024-03-31` → **2024**.

## Pre-computed analysis tables (use, don't recompute)

- `cra.loop_universe` — per-bn loop summary, score 0-23, pre-aggregated
- `cra.loops`, `cra.loop_participants`, `cra.loop_edges`, `cra.loop_financials`
- `cra.identified_hubs`, `cra.partitioned_cycles`, `cra.johnson_cycles`
- `cra.t3010_impossibilities`, `cra.t3010_plausibility_flags`
- `cra.donee_name_quality`
- `cra.scc_components`, `cra.scc_summary`, `cra.matrix_census`

## Canonical query patterns

`/sql/canonical/` ships with parameterized, hand-audited SQL for:

- `findings_feed.sql` — top entities by composite risk score
- `outcome_brief_data.sql` — single-entity dossier
- `counterfactual_knn.sql` — k-NN retrieval for description-NULL grants
- `citizen_lookup.sql` — postal-code rollup
- `ab_dedupe.sql` — A-13 + A-10 CTE pattern

For the new product, the corpus query joins:

```sql
WITH agreement_current AS (...F-3 CTE...),
ab_clean AS (...A-13 + A-10 CTE...)
SELECT
  'fed' AS source_dataset, ref_number AS record_id,
  recipient_legal_name, recipient_business_number, recipient_province,
  prog_name_en, owner_org_title,
  agreement_value, description_en, agreement_start_date
FROM agreement_current
WHERE description_en IS NOT NULL AND length(description_en) >= 80
UNION ALL
SELECT
  'ab' AS source_dataset, id::text AS record_id,
  recipient, NULL, NULL, program, ministry,
  amount, description, payment_date
FROM ab_clean
WHERE description IS NOT NULL AND length(description) >= 80;
```

## Performance targets

| Query type | Budget |
|---|---|
| `/api/search` keyword | <200ms |
| `/api/search` hybrid (BM25 + cosine) | <800ms |
| `/api/draft/evaluate` retrieval | <2s |
| Entity dossier | <2s |

## Connection convention

Per `src/lib/db/pool.ts`: pg pool, max=10, 8s `query_timeout`, 5s `connectionTimeoutMillis`, SSL `rejectUnauthorized: false` for Render.
