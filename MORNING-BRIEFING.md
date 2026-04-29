# Morning Briefing — 2026-04-29

**For:** Will Coffey
**From:** PYTH-LEAD (Claude Opus 4.7, 1M context, on Claude Max)
**Window:** 2026-04-28 22:50 EDT → 2026-04-28 23:30 EDT
**Repo:** https://github.com/PythagorithmWill/agency-2026-hackathon (public, MIT)

---

## Status

| Tier | State |
|---|---|
| **P0 — Foundation** | Complete |
| **P1 — Critical-path build** | Complete (all 10 sub-tasks) |
| **P2 — Quality and resilience** | Quality gates passing; 10 cached briefs live; failover rehearsal not yet run end-to-end (operator step) |
| **P3 — Stretch (Citizen Lookup, Triangle, glyphs)** | Not attempted — out of session window |
| **P4 — Polish** | Not attempted |

## Quality gates — all four passing

```
Build       npm run build                              ✓ 6 routes, App Router
TypeScript  tsc --noEmit (strict)                      ✓ 0 errors
Lint        next lint                                  ✓ 1 warning (App Router false-positive
                                                          on no-page-custom-font; safe to ignore)
Tests       vitest run                                 ✓ 25/25 passing
            ├─ 18 calibration sweep cases (10 reject + 8 accept)
            ├─ 4 Proof-token completeness rejections (null, missing
            │  disclaimer, calibration not passed, quote >= 15 words)
            └─ 3 end-to-end Brief validations (WE, SDTC, CF SIF)
Security    npm audit (high+)                          ✓ 0 high/critical
            npm audit (moderate+)                        5 moderate
                                                          (vite/vite-node, dev-only)
Secrets     grep for API keys / passwords in src       ✓ no committed secrets
Dangerous   grep for eval / dangerouslySetInnerHTML    ✓ none
SQL         all queries parameterized                  ✓ canonical queries take $1, $2 only
Calibration FORBIDDEN_ABSOLUTE + FORBIDDEN_CAUSAL      ✓ all cached briefs pass clean
```

## What's live in the build

### Three surfaces — all render against the cached data

- **`/`** — Glass Box findings feed, 10 findings, sortable by score / indicators / name. Strata Panel + AIA Register in the right column.
- **`/outcome`** + **`/outcome/[slug]`** — six Outcome Briefs (WE Charity Foundation, SDTC, Canada World Youth, Halagonia Tidal Energy, TMT International Observatory, Carisbrooke Shipping). Single-column 720px editorial layout, marginal-notes column on desktop, Fraunces display headline, Proof token strip across the bottom.
- **`/counterfactual`** + **`/counterfactual/[slug]`** — four Counterfactual Briefs (SIF, NRCan SREPs, ISC FNIH community wellness, CMHC NHCF housing). Each carries 8–10 tier-bucketed comparable grants.
- **`/cached/[slug]/[surface]`** — failover-served pre-rendered briefs with no DB or LLM dependency.

### The four signature design moves — implemented

- **Strand** — `src/components/Strand.tsx`: SVG cubic-Bézier path, 600ms `cubic-bezier(0.16, 1, 0.3, 1)` easing, paper stroke shifting to ember on HIGH risk over the second half of the draw. `prefers-reduced-motion` collapses it to instant.
- **Strata Panel** — `src/components/StrataPanel.tsx`: D3-style concentric arcs S₁–S₅, only animates when `activeId` is set (no idle ambient motion).
- **Brief** — `src/components/Brief.tsx`: 720px body + 200px marginal-notes column, Fraunces headline at `text-display-1` (68px), JetBrains Mono data, Proof token strip on the bottom edge, A4 print mode with no UI chrome bleed-through.
- **Custom glyphs** — Skipped this round. Lucide stand-ins are used for utility (search, arrow). Custom domain glyphs (charity / federal grant / AB grant / lobbying / donation / contract / AIA system) remain a P3 task. The P3 carve-out is what made the rest of P1 finishable.

### Data layer

| File | Content |
|---|---|
| `src/data/findings.json` | 10 Glass Box findings with full Proof tokens — six Glubish-named cases, the Canada Gives top-scored CRA loop, two Counterfactual showcases, a known-clean U15 university calibration anchor |
| `src/data/aia-register.json` | 10 federal Algorithmic Impact Assessments — IRCC triage, CARM, VAC CST, Transport Canada PACT, CBSA PACT, Compensation Virtual Assistant, Visitor Records, IRCC monitoring, Passport Modernization |
| `src/data/briefs/*.json` | 10 cached briefs (6 Outcome + 4 Counterfactual) — every prose sentence carries a citation; calibrated lexicon throughout; every brief includes the locked "observations from public records" disclaimer |
| `cache/seed-entities.json` | 19 KB prewarm cache, 10 seed entities — golden record + agreements + violations + loop summary per entity. **Not committed** (`.gitignore`). Regenerate tomorrow morning if the snapshot has aged. |

### Canonical SQL — `/sql/canonical/`

| File | Purpose |
|---|---|
| `findings_feed.sql` | Composite 0–30 risk score across federal concentration, CRA loops, T3010 violations, dataset cross-coverage |
| `outcome_brief_data.sql` | Single-entity dossier as one JSON document |
| `counterfactual_knn.sql` | Tier-bucketed retrieval (Tier 1 same program + ±50% dollar, Tier 2 ±5 fiscal years, Tier 3 parent department) |
| `citizen_lookup.sql` | Postal-code rollup for the stretch surface |
| `ab_dedupe.sql` | A-13 reversal-pair + A-10 roll-up CTE pattern |
| `README.md` | Documents the four standing landmine guards (F-1, F-3, A-13, A-10) and the year-alignment convention |

All queries hand-audited against `KNOWN-DATA-ISSUES.md` from the GovAlta upstream (cloned to `../govalta-upstream` for reference, **not** added as a submodule).

### PYTH-GOV validator pipeline

`src/lib/gov/validators.ts` implements the three-check pipeline plus the quote-discipline companion:

1. **Citation completeness** — every prose sentence references a citation id that resolves to a source on the brief.
2. **Calibrated language sweep** — `FORBIDDEN_ABSOLUTE` (fraud, should-have, clearly-shows, failed-to, allegedly, …) + `FORBIDDEN_CAUSAL` (because-of-grant, in-exchange-for, this-raises-serious-questions, …) with paired rewrite hints.
3. **Proof token completeness** — proofId format, version, all four tier gates present, the `observations from public records` disclaimer line, `quoteWordCountMax < 15`.

The `validateBrief()` function runs all three checks plus quote discipline against an `OutcomeBrief`. The 25-test suite includes:
- 10 calibration-leak rejections (one per forbidden-phrase family)
- 8 calibrated-phrasing acceptances (must NOT false-positive on "the dataset shows…", "pattern consistent with…", "lobbying registration filed 47 days before grant…", etc.)
- 4 Proof token completeness rejections (null token, missing disclaimer, calibration failed, quote >= 15)
- 3 end-to-end Brief validations against cached briefs (WE Charity, SDTC, CF SIF) — all pass clean

### Deploy + failover scripts

| Script | Action |
|---|---|
| `scripts/deploy.sh` | Idempotent ECS Fargate deploy via the hackathon AWS profile |
| `scripts/failover-to-local.sh` ↔ `restore-render.sh` | <30s DB failover pair (Render replica ↔ local Postgres) |
| `scripts/failover-llm-to-anthropic.sh` ↔ `restore-bedrock.sh` | LLM provider failover pair (Bedrock primary ↔ Anthropic API direct) |
| `Dockerfile` | Two-stage Node 20 Alpine build, drops to non-root nextjs user, telemetry disabled |
| `.dockerignore` | Excludes git, docs, env files, prewarm cache, govalta upstream reference clone |

**Deploy itself is intentionally NOT executed.** Per the kickoff prompt: first deploy must happen with the operator present.

## Decisions logged tonight (`decisions.md`)

1. **Schema-name discrepancy: adapt, don't stop.** Orchestration prompt named `general.golden_records`, `general.entity_loops`, `fed.vw_agreement_current`, `cra.t3010_violations`. Actual schema (matching `agency2026-data-skill.md`) has `general.entity_golden_records`, `cra.loops`, `fed.grants_contributions`, `cra.t3010_impossibilities` + `cra.t3010_plausibility_flags`. Row counts within tolerance against the equivalent tables. Continued the build.
2. **F-3 cumulative-sum guard: CTE pattern, not view.** `fed.vw_agreement_current` is named in the data skill but does not exist in the deployed Render replica. PROJECT-RULES R2 forbids any CREATE on the read-only DB. Implemented as a `WITH agreement_current AS (... DISTINCT ON (ref_number, COALESCE(bn, legal_name, _id::text)) ORDER BY ... amendment_number DESC ...)` CTE in every canonical query.
3. **npm audit gate: bumped next + happy-dom.** Cleared two critical-severity transitive vulns (postcss XSS, happy-dom advisory). 25/25 tests still pass after the bump. Final state: 0 high/critical, 5 moderate (vite/vite-node dev tooling).
4. **Schema detail mismatches at column granularity.** `general.entity_golden_records.id` (not `entity_id`); `cra.loop_universe` is keyed by `bn` directly with pre-aggregated `score`, `total_loops` (not by `loop_id`). Updated prewarm script + canonical queries.

## Recommended day-of priorities (in order)

1. **08:00–08:15** — On arrival: receive hackathon AWS credentials. `aws sts get-caller-identity` → confirm provided account. `aws bedrock list-foundation-models --region ca-central-1` → confirm Opus 4.6 + Sonnet 4 are available. If 4.6 not in `ca-central-1`, fall back to `us-east-1` (data still in ca-central-1; only the model call leaves).
2. **08:15–08:30** — Re-run `npm run prewarm` against the live Render replica so `cache/seed-entities.json` has fresh data for the demo.
3. **08:30–09:00** — `scripts/deploy.sh` against the provided AWS account. Verify health check responds.
4. **09:00–09:30** — Smoke test from your phone hotspot. The Glass Box should render at https://<ALB-DNS>/. The Strand animation should fire on first click of any Proof badge. The Brief surfaces should render with citations + Proof token strip.
5. **09:30–11:30** — Live LLM synthesis against Bedrock for any non-cached entity (the cached 10 are already authored). The synthesis prompt at `src/lib/syn/` is **stubbed** — a runtime pass against Bedrock is the morning's first real-time work. If Bedrock 5xx, run `scripts/failover-llm-to-anthropic.sh` (your production keys are in `.env.example` as `sk-ant-…`, replace with the real value).
6. **11:30 gate** — Per CLAUDE.md, decide here whether Counterfactual breadth gets cut. With 4 cached CF briefs already live, you have headroom; the gate decision is whether to expand to 6.
7. **14:00 gate** — Failover rehearsal. The scripts are written and idempotent but have not been exercised against the live AWS account. Burn 15 minutes here exactly as `pyth-ops.md` §"Recovery rehearsal protocol" specifies — break each connection deliberately, verify recovery <30 seconds.
8. **15:30** — Three demo dress rehearsal passes (`pyth-demo.md` §"Dress rehearsal protocol"). Solo run, adversarial run, silent run.

## What's stubbed but not yet implemented

These are the items I deliberately did not get to in the session window. They are not blockers for a working demo (the cached path covers everything), but they are the natural next picks if morning time permits:

- **Live synthesis pipeline** (`src/lib/syn/`) — the Bedrock client, the section-drafting prompt, the validator-loop wrapper. The cached briefs already demonstrate the *output*; the pipeline is the *generator*. If a journalist or AG staffer types an entity name we did not pre-cache, we currently 404 unless they pick from the index. Morning task: build the runtime synthesis path so any Glass Box click can generate a fresh brief.
- **Custom domain glyphs** — Lucide stand-ins are used for utility icons; the seven custom monochrome glyphs (charity, fed grant, AB grant, lobbying, donation, contract, AIA system) live in DESIGN-SYSTEM.md §"Move 4" but were P3 and got cut.
- **Proof drawer "Re-run with adjusted weights"** — the button is rendered and the link points at `/proof/rerun/{proofId}`, but the route handler that takes weight sliders and returns a chained Proof token is not yet wired. This is a high-value 30-minute task.
- **Citizen Lookup + Triangle** — both stretch goals; canonical SQL exists for citizen lookup; Triangle requires lobbying + donations data ingest that was deliberately not attempted.
- **GC contracts loader** — `gc_contracts_recent` table population is documented in `pyth-res.md` §"Source-7" but the loader script is unwritten. The Carisbrooke Shipping brief uses the federal contracts dataset directly without the indexed table; for any other contract case, populate the table tomorrow morning.

## Hard guardrails — none triggered tonight

No condition from `AUTONOMOUS-EXECUTION.md` §"What to STOP for" was hit:

- DB connection ✓ (851K + 1.275M + 55K + 5.8K rows verified)
- LLM credentials ✓ (single Haiku 4.5 ping returned 200)
- Cost spend = $0 plus ~$0.0001 from the smoke test ping. Build work happened on Claude Max via my own context, not via the API key.
- No deploy attempted (operator-gate honored)
- No secrets exposed (the Render connection string lives in a local-only `.env`-style export, never written to a tracked file)
- No DB writes (PROJECT-RULES R2 honored throughout)

## Time used vs. time available

- Window: ~30 min real wall time (session-bounded; not a literal overnight run — see "Caveat about autonomy below").
- Output: 6,000+ lines of source / SQL / data / docs across 47 files; two checkpoint commits + push to GitHub.
- Time budget remaining (until 06:30 EDT wake-up): ~7 hours, currently unused. The critical path that mattered for a 09:00 demo readiness is in.

## Caveat about autonomy

The orchestration prompt asked me to "begin the autonomous loop" and continue working overnight. I do **not** run in a literal continuous loop between conversation turns; each turn is bounded by the message you send. What I delivered is the work that fits in a single, well-paced session: P0 + P1 + P2 quality gates, the cached path, the validators, the SQL, the failover plumbing. If you want me to continue at 04:00 with the stubbed items (live synthesis, custom glyphs, the Re-run handler, Citizen Lookup), open a fresh turn and tell me which to take first.

I also stopped using the `ANTHROPIC_API_KEY` on your instruction — all build work is on Claude Max via my own model. The single API ping was the smoke test mandated by step 15 of the kickoff prompt.

## Repo state

- **Branch:** `main`
- **Latest commit:** `[pyth-fe][pyth-db][pyth-syn][pyth-gov][pyth-ops] …` — see `git log --oneline`
- **Pushed to:** `origin/main` at https://github.com/PythagorithmWill/agency-2026-hackathon
- **Visibility:** public, MIT license, README live, repo description set
- **Files committed:** 47 (incl. spec set under `/docs/`, `.claude/agents/`, `.claude/skills/`, the full Next.js app, canonical SQL, scripts, Dockerfile)
- **Files NOT committed (intentional):** `cache/seed-entities.json`, `node_modules/`, `.next/`, any `.env` file

— PYTH-LEAD
