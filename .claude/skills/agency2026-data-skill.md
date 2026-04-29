# agency2026-data-skill

Encodes the Agency 2026 dataset structure, join keys, data quality gotchas, pre-computed analysis tables, and canonical SQL patterns. Auto-load this skill whenever any agent touches the database.

## The four schemas — one-line overview

| Schema | What it is | Volume |
|---|---|---|
| `general` | Cross-dataset entity resolution backbone | ~793K golden records, ~3.3M source links, ~40K multi-dataset entities |
| `cra` | Canada Revenue Agency T3010 charity filings, 2020–2024 | ~8.6M rows, 46 tables, 3 views |
| `fed` | Federal grants & contributions, 2006–2025, 51+ departments, 422K+ recipients | ~1.275M rows, 6 tables, 3 views |
| `ab` | Alberta open data: grants, contracts, sole-source, non-profit registry | ~2.57M rows, 9 tables, 3 views |

**Always start in `general`.** That's where cross-dataset analysis lives. Drop into source schemas only when you need depth (`cra` for T3010 detail, `fed` for amendment chains, `ab` for sole-source scoring).

## The starting point: `entity_golden_records`

```sql
SELECT
  entity_id,
  canonical_name,
  bn_root,                  -- 9-digit Canadian Business Number root
  bn_variants,              -- JSONB array of all observed BN variants
  aliases,                  -- JSONB array of every name this entity has appeared under
  dataset_sources,          -- TEXT[] e.g. {'cra','fed','ab'}
  cra_profile,              -- JSONB
  fed_profile,              -- JSONB
  ab_profile,               -- JSONB
  addresses,                -- JSONB array (deduped across sources)
  related_entities,         -- TEXT[] of related entity_ids
  total_source_links        -- INT
FROM general.entity_golden_records
WHERE bn_root = $1
LIMIT 1;
```

**Always anchor on BN where available.** Name-based joins are probabilistic; BN is authoritative.

## The data quality landmines (memorize these)

These are listed in `KNOWN-DATA-ISSUES.md` with the full evidence. The headlines:

### F-3: `fed.agreement_value` is cumulative
Each amendment row restates the running total. Naive `SUM` triple-counts. Use:
- `fed.vw_agreement_current` for current commitment
- `fed.vw_agreement_originals` for originals only

### A-13: AB has duplicates and reversal pairs
- 5,557 excess exact-duplicate rows (real repeated micro-payments) inflate `COUNT(*)` for FY 2024-25 + 2025-26
- 951 reversal pairs net to $0 but inflate count by 2x
- For payment counts, dedupe on `(ministry, business_unit_name, recipient, program, amount, payment_date)`

### A-10: AB roll-up rows
`recipient IS NULL` rows are publisher-aggregated programs, ~$25B in FY 2024-25 + 2025-26. Filter or disclose.

### A-6: AB negative amounts
50,381 rows totaling -$13.11B are reversals/corrections per publisher convention.

### F-6/F-7: Federal BN format polyglot
4% of for-profit recipients have no BN. Use `general.extract_bn_root()` to normalize.

### C-3: $8.97B in qualified-donee rows are unjoinable
Use `cra.donee_name_quality` to see the breakdown.

### C-7: CRA name history is mostly missing
Only 1.4% of BNs show any historical name change. CRA appears to backfill current legal names onto historical years.

## Pre-computed analysis tables (use, don't recompute)

### CRA loop & hub analyses
- `cra.loops` — 5,808 simple cycles, 2-6 hops
- `cra.loop_universe` — 1,501 distinct loops scored 0-23 (top: CANADA GIVES at 23/30)
- `cra.loop_participants` — 30,003 entity-loop links
- `cra.loop_edges` — 53,771 edges in the loop graph
- `cra.loop_financials` — dollar flows per loop
- `cra.identified_hubs` — 20 hub entities
- `cra.partitioned_cycles` — 108 hub-partitioned cycles
- `cra.johnson_cycles` — 4,601 simple cycles (independent validation)
- `cra.scc_components` / `cra.scc_summary` — strongly connected components
- `cra.matrix_census` — hub-pair co-occurrence

### CRA data quality outputs
- `cra.t3010_impossibilities` — 54,010 arithmetic violations (cited to T3010 form lines)
- `cra.t3010_plausibility_flags` — 1,075 unit-error candidates
- `cra.donee_name_quality` — $8.97B mismatch breakdown
- `cra.identification_name_history` — name-change events (sparse — see C-7)

### Federal risk
- `fed` ships a 7-dimension risk scoring infrastructure (0-35 scale). Check the FED module docs for the canonical query.

### AB analysis
- AB ships 6 advanced analysis scripts producing JSON + TXT reports under `AB/data/reports/`. Inspect those before writing new sole-source pattern detection.

## Canonical query patterns

### Postal code → all entities
```sql
SET search_path TO general, cra, fed, ab, public;

SELECT
  e.entity_id,
  e.canonical_name,
  e.bn_root,
  e.dataset_sources,
  COALESCE((e.fed_profile->>'total_grants')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_grants')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_contracts')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_sole_source')::numeric, 0) AS total_external_funding
FROM general.entity_golden_records e
WHERE e.addresses @> jsonb_build_array(jsonb_build_object('postal_code', $1))
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.addresses) a
    WHERE a->>'postal_code' = $1
  )
ORDER BY total_external_funding DESC
LIMIT 50;
```

### Federal funding to a recipient (correctly summed)
```sql
SELECT
  recipient_legal_name,
  COUNT(*) AS agreement_count,
  SUM(agreement_value) AS current_commitment_total
FROM fed.vw_agreement_current
WHERE recipient_business_number = $1
GROUP BY 1;
```

### Amendment creep cases (>2x growth)
```sql
SELECT
  v.ref_number,
  v.recipient_legal_name,
  o.agreement_value AS original_value,
  v.agreement_value AS current_value,
  (v.agreement_value / NULLIF(o.agreement_value, 0)) AS growth_multiple
FROM fed.vw_agreement_current v
JOIN fed.vw_agreement_originals o
  ON v.ref_number = o.ref_number
  AND COALESCE(v.recipient_business_number, v.recipient_legal_name)
    = COALESCE(o.recipient_business_number, o.recipient_legal_name)
WHERE o.agreement_value > 0
  AND v.agreement_value / o.agreement_value > 2
ORDER BY v.agreement_value DESC
LIMIT 100;
```

### Loops involving a specific entity
```sql
SELECT
  lu.loop_id,
  lu.score,
  lu.hops,
  lu.path_bns,
  lu.notes
FROM cra.loop_universe lu
JOIN cra.loop_participants lp ON lp.loop_id = lu.loop_id
WHERE lp.bn = $1
ORDER BY lu.score DESC, lu.hops ASC
LIMIT 20;
```

### Cross-dataset funding for one entity
```sql
SELECT
  jsonb_build_object(
    'entity_id', e.entity_id,
    'canonical_name', e.canonical_name,
    'cra_summary', e.cra_profile,
    'fed_summary', e.fed_profile,
    'ab_summary', e.ab_profile,
    'cross_dataset_total',
      COALESCE((e.fed_profile->>'total_grants')::numeric, 0) +
      COALESCE((e.ab_profile->>'total_grants')::numeric, 0) +
      COALESCE((e.ab_profile->>'total_contracts')::numeric, 0) +
      COALESCE((e.ab_profile->>'total_sole_source')::numeric, 0)
  ) AS dossier
FROM general.entity_golden_records e
WHERE e.entity_id = $1;
```

### Sole-source repeat-vendor pattern (AB)
```sql
SELECT
  vendor,
  COUNT(*) AS contract_count,
  SUM(amount) AS total_value,
  array_agg(DISTINCT ministry ORDER BY ministry) AS ministries
FROM ab.ab_sole_source
WHERE amount IS NOT NULL
GROUP BY 1
HAVING COUNT(*) >= 5
ORDER BY total_value DESC
LIMIT 50;
```

### Director overlap (Challenge 6)
```sql
WITH director_keys AS (
  SELECT
    bn,
    UPPER(TRIM(last_name)) || '|' || UPPER(TRIM(first_name)) AS director_key
  FROM cra.cra_directors
  WHERE last_name IS NOT NULL
    AND first_name IS NOT NULL
)
SELECT
  d1.director_key,
  array_agg(DISTINCT d1.bn) AS bns,
  COUNT(DISTINCT d1.bn) AS entity_count
FROM director_keys d1
GROUP BY 1
HAVING COUNT(DISTINCT bn) >= 3
ORDER BY 3 DESC
LIMIT 100;
```

**Caveat:** The C-6 nulls (~5% null `at_arms_length`, 0.1% null `first_name`) silently drop overlap candidates. Surface this in the UI.

## Year alignment convention

Across CRA (`fpe`), FED (`agreement_start_date`), and AB (`fiscal_year`), the year label is "fiscal year ending in calendar year X" (Apr 1 – Mar 31).

- AB: `"2023 - 2024"` → year label **2024**
- FED: start date 2023-10-01 → year label **2024** (start month >= April → +1)
- CRA: `fpe = 2024-03-31` → year label **2024**

CRA charities can pick non-March fiscal year ends. We treat `fpe` year as authoritative regardless of month.

## Performance and connection tips

- Render DB has read-only credentials in module `.env.public` files (distributed in event-day info pack)
- Connection pool: keep ≤4 concurrent queries per agent; the pool is shared
- If Render is congested, switch to local DB via `.local-db/import.js` (full pipeline copy in your Postgres)
- All schemas have GIN trigram indexes on canonical names — name searches are <200ms even at 800K-entity scale
- The `entity_golden_records` table is your friend; the JSON profiles are pre-aggregated

## When to write new SQL vs reuse

| Question | Existing answer? | Where |
|---|---|---|
| Funding loops | YES | `cra.loop_universe` |
| Hub entities | YES | `cra.identified_hubs` |
| T3010 violations | YES | `cra.t3010_impossibilities` |
| Federal risk score | YES | `fed.*` 7-dim scoring |
| Sole-source patterns | YES | `AB/data/reports/` |
| Cross-dataset funding | YES | `entity_golden_records.*_profile` |
| Director networks | NO — write new | n/a |
| Outcome briefs (synthesized) | NO — new build | n/a |
| Postal code aggregation | NO — write new | n/a |
| Triangle (lobbying × donations × grants) | NO — ingest new sources | n/a |

When in doubt, search for it before writing it.
