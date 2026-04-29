# Session 8 · TRACE methodology integration

Date: 2026-04-29
Branch: `rebuild-suitability`
Rollback tag: `glassbox-pre-trace`
Last commit before report: `468799c`

---

## 1. Rollback tag

`glassbox-pre-trace` exists locally and on origin (`PythagorithmWill/agency-2026-hackathon`). Snapshot of the codebase immediately before the TRACE methodology integration began. Recover with:

```bash
git checkout glassbox-pre-trace
```

Other tags still in place: `glassbox-pre-transparency`, `manifold-experiment-final`, `rebuild-stable-pre-visual`, `v1-flat-stable`.

---

## 2. UX updates — "Follow the money"

The canonical UX phrase is live across four surfaces:

- **Hero subhead** (`src/components/home/Hero.tsx`) — replaced the previous descriptive paragraph with: *"Follow the money — federal grants, Alberta contracts, charity flows, sole-source amendments — across millions of records, in calibrated language, with full citation."*
- **Homepage Follow-the-Money section** (`src/components/home/FollowTheMoneySection.tsx`) — new section between Hero and ExplainerCards. Display-md headline with accent period, italic muted subhead, 3×2 grid of the six TRACE-derived patterns, "+ 6 more patterns →" link to `/follow`.
- **Site nav** (`src/components/SiteHeader.tsx`) — "Follow the money" added as the first nav item, before Transparency / Methodology / Search / Evaluate. Same pass also removed the square mark next to the wordmark per latest brand spec.
- **Homepage footer** (`src/components/home/HomepageFooter.tsx`) — new line below the existing methodology citation: *"Follow the money — Alberta TRACE methodology, federal corpus, open source."*

---

## 3. /follow landing page

Live at `/follow`. Reads from `src/lib/patterns/registry.ts` and renders all twelve patterns as `PatternCard` components in a 3-column responsive grid. Hero strip explains the 6 TRACE-derived / 6 Glassbox-native split. Footer band has two attribution panels: TRACE lineage (linking to `/trace`) and calibrated language (linking to `/methodology`).

`PatternCard` shows for each pattern: name, status pill (live / beta / coming), one-sentence calibrated definition, mono-cap detection signal, match count or "Run detector" placeholder, and — for TRACE patterns — the attribution line "Pattern based on Alberta TRACE methodology".

Card hovers transition border colour; whole card is a link to `/follow/<slug>`. Stagger reveal at 60ms intervals via `whileInView`.

---

## 4. Pattern detectors — status

| Pattern | Slug | Attribution | Status | Detector module |
|---|---|---|---|---|
| Zombie Recipients | `zombie-recipients` | TRACE | beta | not yet built |
| Ghost Capacity | `ghost-capacity` | TRACE | beta | not yet built |
| Funding Loops | `funding-loops` | TRACE | **live** | `funding-loops.ts` |
| Sole-Source Amendment Creep | `sole-source-creep` | TRACE | beta | not yet built |
| Threshold Splitting | `threshold-splitting` | TRACE | beta | not yet built |
| Indefinite Sole-Source | `indefinite-sole-source` | TRACE | coming | not yet built |
| Concentration Capture | `concentration-capture` | GLASSBOX | beta | not yet built |
| Amendment Purpose Drift | `amendment-purpose-drift` | GLASSBOX | **live** | `amendment-purpose-drift.ts` |
| End-of-Year Clustering | `end-of-year-clustering` | GLASSBOX | coming | not yet built |
| Cross-Jurisdictional Same-Recipient | `cross-jurisdictional` | GLASSBOX | coming | not yet built |
| Lobbying-Grant Correlation | `lobbying-grant-correlation` | GLASSBOX | coming | not yet built |
| Donation-Grant Correlation | `donation-grant-correlation` | GLASSBOX | coming | not yet built |

Two detectors live; ten unimplemented. The /follow/[slug] page handles all three states cleanly (live → MatchList; beta → "Detector in beta" panel; coming → "Detector pending" panel).

---

## 5. /follow/[slug] detail pages

Live at `/follow/<any-slug>`. notFound() for unknown slugs. Hero strip: status pill, headline, definition, detection signal, TRACE attribution line where applicable.

When a detector is registered for the slug, the page invokes it (`detector.detect({ limit: 25 })`) and renders the result via `MatchList`:
- Subject canonical name (heading)
- subject.type · subject.id mono row
- Calibrated summary
- Source-records-cited count
- Severity pill (observation / attention / flag)
- "View source record →" or "View recipient profile →" link based on subject.type

When no detector or detection fails, falls through to `PendingPanel` / `DetectorErrorPanel` panels.

---

## 6. /follow/[slug]/[matchId] evidence detail

Not built this session. The match list links to existing `/record/fed/<recordId>` and `/recipient/<bn>` pages, which is sufficient for the demo. A dedicated per-match evidence route ships in the next push.

---

## 7. /trace attribution page

Live at `/trace`. Six-section editorial-style page:

01. **What is TRACE?** — describes the program, cites the Substack source (Glubish, April 13 2026), names the schemas (`cra.*`, `general.*`).
02. **What Glassbox adds** — federal corpus expansion, calibrated-language discipline, audit-token provenance, public-facing UX.
03. **Data lineage** — table mapping each Glassbox surface (`/follow/funding-loops`, `/recipient/[bn]`, etc.) to the TRACE data product it consumes.
04. **Aligned with the Alberta AI Usage Policy** — links to `/compliance` for line-by-line mapping.
05. **Disclaimer** — explicit statement that the Ministry has not endorsed Glassbox; we credit the methodology lineage, not partnership.
06. **Cite as** — formatted citation block.

---

## 8. /compliance page

Live at `/compliance`. Three-column table (policy requirement | Glassbox implementation | status) covering:

- Sovereign compute → met (no third-party AI in detection; calibration is local regex; semantic retrieval opt-in)
- Open-source models → met (MIT, all detectors in `src/lib/patterns/` are inspectable)
- Audit trails → met (audit token on every output)
- Accountability for outputs → met (calibrated-language discipline; citation rigor)
- Cybersecurity gates → marked deployment-stage (placeholder Terraform stubs in `infra/aws/security/`)

---

## 9. Pattern visualizations

Not built this session. The viz library (`AnimatedBar`, `AnimatedDonut`, `AnimatedSparkline`, `AnimatedAreaChart`, `LorenzCurve`) ships as part of the transparency dashboard work and is reusable.

Pattern-specific viz (`FundingLoopVisualization`, `AmendmentTrajectoryChart`, `ZombieTimeline`, `ConcentrationLorenz`, `GhostCapacityMatrix`, `CrossJurisdictionalSankey`) is a P8 task — deferred to maximise detector coverage in this session.

---

## 10. Run infrastructure

Skeleton built:
- `/api/patterns/[slug]/matches` GET — returns live detector output as JSON. Query params: `limit` (max 200), `minSignal` (observation | attention | flag).

Not built:
- Persistent run audit table
- POST `/api/patterns/run/[slug]` to trigger and cache a run
- EventBridge schedule

Detectors run on-demand at request time. For the funding-loops detector this is fast (<2s for 25 matches); for amendment-purpose-drift it's at the edge of the 8s pool budget (window scan over 1.27M rows). The cache layer is the next thing to build before public launch.

---

## 11. Quality gates

- TypeScript: clean (`tsc --noEmit`).
- Tests: 73/73 passing across 8 test files.
- Routes: `/`, `/follow`, `/follow/funding-loops`, `/follow/amendment-purpose-drift`, `/follow/zombie-recipients` (beta panel), `/trace`, `/compliance`, `/transparency`, `/transparency/{departments,recipients,programs,forecasts,risk}`, `/department/<slug>`, `/recipient/<bn>` — all 200.
- Calibrated-language sweep: detector outputs and pattern definitions reviewed; no `fraud`, `should have`, `clearly shows`, `caused`.

---

## 12. Known issues

- **Snapshot v2 build is slow.** The /transparency/department detail pages depend on per-department profiles in the snapshot (top 15 departments). Snapshot build takes ~10–15 minutes against the live Render replica because the F-3 max-amendment CTE on 1.27 M rows is the dominant cost. The user's build was running for ~30+ minutes at the time of this writing — investigation pending. The dashboard pages gracefully degrade for v1 snapshots with a "Detailed profile not in snapshot" warning.
- **Amendment-purpose-drift latency.** First-page render at /follow/amendment-purpose-drift takes ~8 seconds, right at the pool query_timeout. Caching the detector run in `glassbox_extended.normalized.pattern_matches` is the right next step.
- **Ten detectors unimplemented.** Spec asked for 12 detectors (P3). Two live, ten not. Listed in section 4. Demo can run on the two live ones; full pattern coverage ships in the next session.
- **Per-match evidence page absent.** `/follow/[slug]/[matchId]` route does not exist; match links go directly to `/record/fed/...` or `/recipient/...`. Adequate for demo.
- **Build error reported by user.** User encountered `database "will.coffey" does not exist` running the snapshot script standalone. Root cause: `process.env.DATABASE_URL` was unset because Next.js env-loading didn't apply to standalone Node scripts. Fix shipped in `scripts/build-snapshot.ts` — auto-loads `.env.local` if `DATABASE_URL` is unset. Verified working.

---

## 13. Pattern match counts (live snapshot)

From the live Render replica via the funding-loops detector:

- **Score ≥ 12 (TRACE attention threshold):** 198 entities total in `cra.loop_universe`.
- **Score ≥ 18 (Glassbox flag severity):** 64 entities (these surface as "flag" pills).
- **Score ≥ 15 (attention):** 134 entities.
- **Score 12–14 (observation):** 64 entities.

Top three by score (real demo data):
1. **CANADA GIVES** (BN 833062144RR0001) — score 23/23, 321 circular flows totalling $4,101,722, predominantly long-chain (length ≥ 4).
2. **FONDATION BEATI** (BN 137156360RR0001) — score 22/23, 6 circular flows totalling $225,000.
3. **My Charity Fund** (BN 741413892RR0001) — score 21/23, 340 circular flows totalling $2,258,665.

For amendment-purpose-drift, count is dynamic (depends on description-similarity threshold); the detector returns up to 25 per request. Spot-check shows non-empty results from the federal corpus.

---

## 14. Next steps

In rough priority order:

1. **Cache pattern runs.** Build `glassbox_extended.normalized.pattern_matches` write path; have detectors check cache first and only re-run on demand or schedule.
2. **Investigate snapshot v2 build runtime.** Either parallelise the per-department queries (carefully — long pool has max 2 connections) or drop to top 5 departments instead of top 15 if 15 turns out to be unreasonable for nightly cadence.
3. **Implement remaining 10 detectors.** Sole-source-creep and concentration-capture are the next two — both can reuse existing `loadConcentrationFed` / amendment-chain query infrastructure.
4. **Pattern-specific visualisations** (`FundingLoopVisualization`, `AmendmentTrajectoryChart`, `ConcentrationLorenz`).
5. **Per-match evidence pages** at `/follow/[slug]/[matchId]`.
6. **Integrate AWS credentials.** User has CLI credentials available. Wire EventBridge schedule for nightly snapshot + pattern-run rebuilds; deploy CloudWatch dashboard + log forwarding.
7. **Live ingestion pipeline** (P6 from the previous spec): DataSource registry, BigEhBrother enumerate, first fetcher writing JSON to `data/sources/`. Lobbying and donation correlation patterns become "live" once that ships.

---

*Built on Alberta TRACE methodology — federal corpus, calibrated language, full citation.*
