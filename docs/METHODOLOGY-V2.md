# Methodology v2 — operator guide

**Status:** active on branch `methodology-v2` (2026-09-24).
**Audience:** whoever runs a data refresh or debugs a `/follow` page.
**Companion pages:** `/methodology` (public rules), `/trace` (attribution and provenance), `/transparency/data-quality` (scorecard).

Glassbox is built on the Alberta TRACE methodology as described by the Ministry of Technology and Innovation. The term "TRACE" does not appear in the upstream repository; the pattern-to-script mapping on `/trace` is Glassbox's interpretation, and every threshold listed below is a Glassbox choice unless a specific upstream file is cited.

---

## 1. Pipeline

```
raw source tables            canonical tables              detectors                 pattern_matches           pages / API
fed.grants_contributions ──▶ app.fed_agreement_current ──▶ src/lib/patterns/*.ts ──▶ app.pattern_matches ────▶ /follow/[slug]
cra.*                        app.cra_*                     (one module per pattern)   (+ per-pattern counts,    /follow
ab.*                         app.ab_payments_dedup                                     filter dimensions)       /api/patterns/[slug]/matches
                             app.data_quality_scorecard ───────────────────────────────────────────────────────▶ /transparency/data-quality
                                                                                       data/analytics-snapshot.json ─▶ fallback for every page above
```

1. **Canonical tables** (`sql/`, built by `scripts/refresh-derived.ts`). Each applies the documented landmine guards once, upstream of every query: F-1 chain keys `(ref_number, COALESCE(bn, legal_name, _id))`, F-3 `DISTINCT ON … ORDER BY amendment_number DESC` for current-amendment rows, A-13 duplicate/reversal collapse, A-10 recipient-NULL roll-up exclusion, C-7 current-state-only charity names.
2. **Detectors** (`src/lib/patterns/<pattern>.ts`, registered in `src/lib/patterns/detectors.ts`, described in `src/lib/patterns/registry.ts`). Each reads canonical tables only, computes its signal, assigns a four-band severity (`low | medium | high | critical`), an evidence-strength score, and — where the registry lists `falsePositiveNotes` — a `benignNote` explaining the most likely innocent reading.
3. **`pattern_matches`** (written by the refresh scripts, read through `src/lib/patterns/store.ts`). One row per `(patternId, matchId)` with subject, severity, signal, `evidenceStrength`, `benignNote`, `calibratedSummary`, the evidence array (source, rowId, field, value, asOf), and the filter dimensions `department`, `province`, `fiscalYear`, plus `computedAt`.
4. **Pages and API.** `loadPatternMatches()` pages and filters the table; `loadPatternCounts()` feeds `/follow`; `loadPatternFilters()` populates the filter bar; `loadDataQualityScorecard()` feeds the scorecard. When the table is absent or unreachable, the store returns `source: "snapshot"` from `data/analytics-snapshot.json` (top 50 per pattern, no filters) and every page degrades to the v1 behaviour.

## 2. Severity, strength and thresholds

| Concept | Meaning | Where defined |
|---|---|---|
| **Severity** (`low/medium/high/critical`) | Distance of the match from its comparable population. Collapsed to observation / attention / flag on the pages. | each detector |
| **Evidence strength** (`0–1`) | How much of the published record supports the match: row volume, recency, corroborating rows across sources. Independent of severity. Labelled weak `< 0.40`, moderate `< 0.70`, strong `≥ 0.70`. | `src/lib/patterns/strength.ts` |
| **Relative thresholds** | Percentile cutoffs over the comparable population (same department / program / fiscal-year window), recomputed each refresh. | each detector |
| **Rolling windows** | Time-relative windows measured from the refresh date. Zombie recipients: last agreement start `< today − 36 months` (upstream `FED/scripts/advanced/05-zombie-and-ghost.js` uses a fixed `2022-01-01`). | detectors |
| **Loop score bands** | 12 / 15 / 18 → observation / attention / flag. Glassbox choice; upstream `CRA/scripts/advanced/02-score-universe.js` reports ≥ 15 and ≥ 10 only. | `funding-loops.ts` |
| **Growth ratio** | Always `latest ÷ original` per F-1 chain key. `agreement_value` is cumulative (F-3); never sum amendment rows. | `sole-source-creep.ts`, `amendments.ts` |

`benignNote` text and `calibratedSummary` text pass the calibration sweep in `src/lib/gov/validators.ts` (no verdict words, no causal claims, no reader direction).

## 3. Refresh procedure

Run against the owned database (`DATABASE_URL` in `.env.local`; a full local copy is `postgresql://localhost:5432/agency26`).

```bash
# 1. Rebuild canonical tables + pattern_matches + data-quality scorecard
npx tsx scripts/refresh-derived.ts

# 2. Rebuild the CRA loop universe (slow; only when cra.* changed)
npx tsx scripts/refresh-loops.ts

# 3. Rebuild the static snapshot (fallback for every page; also the source of
#    corpus figures in site copy)
npx tsx scripts/build-snapshot.ts
```

Order matters: the snapshot build reads the derived tables so the fallback matches the live view. Each script auto-loads `.env.local` when `DATABASE_URL` is unset.

## 4. Verifying a refresh

- `/follow` — every card shows a live count; footer says *live totals from the pattern_matches store*.
- `/follow/<slug>` — footer says *Source · live pattern_matches table · computed <timestamp>*; the filter bar is present; `?page=2` pages; `?strength=0.7` narrows.
- `/api/patterns/<slug>/matches?limit=5` — JSON has `source: "table"`, `total`, and every row has `evidenceStrength` and `benignNote`.
- `/transparency/data-quality` — no *Snapshot pending* panel; `computedAt` is the refresh time.
- `npm run typecheck && npm test && npm run lint` — clean.

## 5. Pages that read the store

| Route | Reads | Degrades to |
|---|---|---|
| `/follow` | `loadPatternCounts` | snapshot per-pattern array lengths |
| `/follow/[slug]` | `loadPatternMatches`, `loadPatternFilters` | snapshot top 50, filter bar hidden |
| `/api/patterns/[slug]/matches` | `loadPatternMatches` | snapshot top 50, `source: "snapshot"`, edge-cacheable |
| `/transparency/data-quality` | `loadDataQualityScorecard` | *Snapshot pending* panel |
