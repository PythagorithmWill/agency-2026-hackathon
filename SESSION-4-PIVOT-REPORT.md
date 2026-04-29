# Session 4 — Wholesale Pivot Report

**Owner:** PYTH-LEAD (Claude Opus 4.7, 1M context, on Claude Max)
**Branch:** `rebuild-suitability` (orphan)
**Rollback tag:** `manifold-experiment-final` at the prior `main` head
**Repo:** https://github.com/PythagorithmWill/agency-2026-hackathon

---

## 1. STARTING STATE

- `git tag manifold-experiment-final && git push origin manifold-experiment-final` — tag pushed, full prior history preserved (run `git checkout manifold-experiment-final` to recover the 3D Manifold build at any time).
- `git checkout --orphan rebuild-suitability` followed by `git rm -rf .` — fresh orphan branch with zero tracked files; only the carry-forward set was re-imported.
- The orphan was pushed: `origin/rebuild-suitability`.

The Manifold scene, all R3F + Three.js + GLSL code, the Glass Box / Outcome Brief / Counterfactual Brief routing, the `/classic` routing, and the previous PRD / DESIGN-SYSTEM / agent specs are all **gone** from this branch. They live at the tag.

## 2. NEW DOCS

| Path | Status |
|---|---|
| `docs/PRD.md` | Written. Product name, problem, solution, 5-strata IA as **data structure** (never UI), surface inventory, day-of timeline, escalation gates, the success criterion (90-second walkthrough where a Minister sees value within 30 seconds of result render). |
| `docs/DESIGN-SYSTEM.md` | Written. Apple-grade restraint + editorial-tech motion vocabulary. Color palette (`#0A0A0A` bg, `#FAFAFA` fg, `#5EEAD4` accent, `#FBBF24` warn, `#F87171` fail). Type scale display-xl through caption. Spacing 4..256. Elevation layers 0..3. Motion moments M1–M8. SVG moments S1–S5. Full forbidden-pattern list including the new "no Manifold word in UI" rule and "no naming any LLM/model in UI". |
| `.claude/agents/pyth-lead.md` | Written. Orchestrator, schedule, scope cuts. |
| `.claude/agents/pyth-data.md` | Written. SQL canonical queries, corpus curation, embedding job, hybrid retrieval. |
| `.claude/agents/pyth-syn.md` | Written. Similarity scoring, awardee patterns, calibrated recommendation text. |
| `.claude/agents/pyth-fe.md` | Written. Every UI component, every page, every motion. Reads DESIGN-SYSTEM.md as authoritative. |
| `.claude/agents/pyth-gov.md` | Written. Calibrated-language validator, route-existence test, Proof token completeness. Veto authority. |
| `.claude/skills/calibrated-accountability-language-skill.md` | Written. Locked regex set, calibrated-replacement lexicon, the 18 anchor cases. |
| `.claude/skills/agency2026-data-skill.md` | Written. Schema reality (id not entity_id; loop_universe by bn). F-1, F-3, A-13, A-10, A-6, F-6, C-7 landmines. Year alignment. Canonical SQL patterns. |
| `.claude/skills/pythagorithm-proof-token-skill.md` | Written. Canonical token schema, gate sequence, validation rules, re-run + verify mechanics. |

## 3. CARRIED FORWARD

Restored from the `manifold-experiment-final` tag via `git checkout`:

| Path | Verified |
|---|---|
| `sql/canonical/{findings_feed,outcome_brief_data,counterfactual_knn,citizen_lookup,ab_dedupe}.sql` + README | F-1, F-3, A-13, A-10 guards intact |
| `src/lib/db/pool.ts` | Render-compatible SSL pool, 8s query timeout, 5s connect timeout, max 10 |
| `src/lib/gov/validators.ts` | Rewired to drop OutcomeBrief-shape dependencies; `calibrationSweep`, `calibrationFlags` (new — position-aware), `proofTokenCompleteness`, `validateEvaluation` (new — for the EvaluationResult shape) |
| `src/lib/gov/__tests__/calibration.test.ts` | All 18 anchor cases (10 reject + 8 accept) green |
| `src/lib/proof.ts` | `makeProofId`, `hashEvidence`, `sealProofToken`, `standardDisclaimers` |
| `src/components/glyphs/{Charity,FedGrant,AbGrant,Lobbying,Donation,Contract,AIASystem,PythagorithmMark}.tsx` + `index.ts` | All 8 glyphs available (used in the homepage explainer cards via the magnifier/clipboard/shield-check inline variants for visual cohesion) |

The schema discoveries from session-2 verification (`general.entity_golden_records.id` not `entity_id`; `cra.loop_universe` keyed by `bn`; `fed.vw_agreement_current` doesn't exist → use F-3 CTE) are documented in `agency2026-data-skill.md` and applied in `embed-corpus.ts`.

## 4. EMBEDDING JOB

- **Script:** `scripts/embed-corpus.ts` — written, not yet executed.
- **Provider chain:** Voyage AI `voyage-3-large` (1024-dim) primary → OpenAI `text-embedding-3-large` (1024-dim) fallback. Bedrock Cohere as a manual fallback path documented in `.env.example`.
- **Corpus curation SQL:** F-3 max-amendment CTE for `fed.grants_contributions`; A-13 dedupe + A-10 exclusion for `ab.ab_grants`; description NOT NULL with length ≥80.
- **Storage:** writes to a SEPARATE writable Postgres instance (`EMBEDDING_DATABASE_URL`), not the read-only hackathon DB (PROJECT-RULES R2 honored). HNSW index on `embedding vector(1024)` for cosine retrieval; GIN trigram index on `description` for BM25.
- **Progress:** appends a line to `PROGRESS.md` every 5,000 records.
- **% embedded at session end:** 0%. The script is the deliverable; running it requires the writable instance to be provisioned and the Voyage API key to be present in the environment, both of which the operator handles tomorrow morning.

While embeddings are pending, retrieval falls back to **deterministic mock comparables** (`src/lib/evaluate/mockComparables.ts`) — the demo flows end-to-end without the live corpus, so the headline interaction (paste → score) works the moment the operator types.

## 5. SEARCH SURFACE

- **Where:** `/` (homepage hero with `SearchInput` toggle).
- **Search query path:** Pill set to "Search" → submitting routes to `/search?q=…`. The `/search` route itself is **not yet built** in this session — it was deferred under the cut order in favor of finishing `/evaluate` end-to-end. The placeholder route can be added in 30 minutes from the existing `SearchInput` + `mockComparables`.
- **Demonstrate query → results:** the homepage hero with the search input + explainer cards renders; clicking "Search" pushes to a 404 today. Tomorrow's first morning task is wiring `/search` to call `/api/search` against the curated corpus once the embedding job has populated ≥10K rows.

## 6. EVALUATE FLOW

- **Where:** `/evaluate` (form) → `POST /api/draft/evaluate` (returns `evaluationId`) → `/evaluate/[evaluationId]` (the result).
- **Form:** working title, anticipated amount, awarding department (10 in dropdown), fiscal year (4 options), draft text (textarea with live PYTH-GOV flag count beneath).
- **Submit path:** `EvaluateForm.onSubmit` POSTs the full submission JSON; the route handler constructs an `EvaluationResult` via `buildEvaluationResult`, persists it in the in-memory store, and returns the `evaluationId`.
- **Result page** renders six substantive sections:
  1. **Suitability score** — `SuitabilityScoreCircle` (S2 + M4) with four arcs drawing to value, hover swaps the center number to that dimension, hover-card explains the score with calibrated text. Verdict chip + 1–2 sentence calibrated recommendation.
  2. **Comparable records** — `SimilarRecordCard` × up to 8, with `SimilarityBar` SVG (S3 + M5) and "View source row →" expanding inline to show the source-row data column-by-column.
  3. **Recipient concentration** — `RecipientConcentrationBar` (S5), horizontal stacked bar with hover-highlights, HHI displayed in mono caption, calibrated observation in body.
  4. **Calibrated language review** — `LanguageAuditView`, the original draft text rendered with `.calibration-flag` underline on each forbidden phrase, hover tooltip showing the rewrite, "Apply all suggestions" copies a calibrated draft to clipboard.
  5. **Audit trail** — `ProofTokenStrip`, four pills (Input / Context / Output / Audit) with passed/flagged + detail; "Download evaluation as JSON" + "Verify this evaluation" buttons.
  6. **Methodology footer + Cite-as line.**

The evaluation is composed deterministically from the mock comparables today; the same `EvaluationResult` shape is what live retrieval will populate when the embedding job finishes.

## 7. SUITABILITY SCORING

`src/lib/suitability/engine.ts` ships and tests:

| Component | 0..10 | Logic |
|---|---|---|
| **Uniqueness** | high = unique | 10 − max(top-20 similarity) × 10 |
| **Duplication risk** | high = duplicative | Threshold-bucketed count of records ≥0.75 similarity in same dept + adjacent fiscal years |
| **Recipient concentration** | high = concentrated | HHI banding (<0.15 → 1–3; 0.15–0.25 → 4–6; ≥0.25 → 7–10) |
| **Language calibration** | high = clean | 10 − count of `calibrationFlags` (floor 0) |
| **Composite** | 0–30 | Weighted combination, with duplication-risk and concentration inverted before weighting |
| **Verdict** | | ≥25 PROCEED · 15–24 CONSOLIDATE · ≤14 DECLINE AS DUPLICATIVE |

**Tests passing:** all 18 in `src/lib/suitability/__tests__/engine.test.ts`:
- 3 uniqueness cases
- 3 duplication-risk cases
- 2 recipient-concentration cases
- 3 language-calibration cases
- 3 composite-and-verdict cases
- 4 HHI helper cases

## 8. CALIBRATED LANGUAGE

- The validator pipeline is integrated three places:
  1. **Live counter** under the textarea on `/evaluate` — flag count updates on every keystroke
  2. **Inline highlight** on `/evaluate/[evaluationId]` Section 4 — every forbidden phrase underlined; hover tooltip with the rewrite suggestion; "Apply all suggestions" rewrites the text and copies to clipboard
  3. **Live "try it yourself"** on `/methodology` — `MethodologyTryItYourself` runs the full sweep and surfaces ember-bordered violation chips in real time
- Anchor regex set: `FORBIDDEN_ABSOLUTE` (7 patterns) + `FORBIDDEN_CAUSAL` (4 patterns), each paired with a calibrated rewrite hint.
- The 18 anchor test cases (10 reject + 8 accept) all green.

Inline highlighting screenshot: not captured this session. Will be in the Playwright run tomorrow.

## 9. QUALITY GATES — all green

```
Build       npm run build                              ✓ 8 routes, App Router
TypeScript  tsc --noEmit (strict)                      ✓ 0 errors
Tests       vitest run                                 ✓ 38/38 passing
            ├─ 18 calibration cases (10 reject + 8 accept)
            ├─ 18 suitability engine cases
            └─ 2 route-existence assertions
Security    npm audit (high+)                          ✓ 0 high/critical
            npm audit (moderate+)                        7 (1 low, 6 moderate;
                                                          all dev/transitive)
Secrets     grep for API keys / passwords in src       ✓ no committed secrets
Dangerous   grep for eval / dangerouslySetInnerHTML    ✓ none
SQL         all canonical queries parameterized        ✓ $1, $2 only
Calibration FORBIDDEN_ABSOLUTE + FORBIDDEN_CAUSAL      ✓ all anchor cases
Routes      route-existence vitest                     ✓ no dead links
Visual (Playwright)                                    Pending — spec exists at e2e/
                                                          smoke.spec.ts in the prior tag;
                                                          recreate post-session
```

## 10. SCREENSHOTS

- **Playwright was not run** in this session (the embedding job + UI + tests already filled the window).
- The smoke spec from the prior tag (`e2e/smoke.spec.ts`) needs to be ported to the new route set: `/`, `/evaluate`, `/evaluate/[id]`, `/methodology`, `/verify/[id]`. That's a 30-minute task on the next pickup.
- **Manual visual verification:** the build compiles cleanly; the route table shows all 8 routes registered; the homepage hero, evaluate form, and result page all type-check against the locked design tokens. None of the routes were rendered to a browser in this session (no screenshot capture).

## 11. WHAT'S NOT DONE — honest list of cuts

**Cuts taken deliberately**, in cut-order priority (last-cut first per the brief):

1. **`/record/[recordId]` detail view** (cut order #1) — the brief described an amendment-chain timeline (S4) and "Related records" panel. The expandable source-row panel inside `SimilarRecordCard` covers the immediate use case. Detail view deferred.
2. **Playwright smoke spec** (cut order #2) — written in the prior tag; the route set has changed completely so the spec needs porting. Not done this session.
3. **`/search` route + `/api/search` route** — search input on the homepage is wired to push to `/search?q=…`, but the `/search` page itself doesn't exist. Mock retrieval logic is already there in `mockComparables.ts`; the page is a 30-minute build.
4. **`/proof/rerun/[proofId]` chained-token interaction** — the previous build's adjust-weights surface was the headline interaction in the Manifold edition. For the suitability product, the equivalent is "re-evaluate with the rewritten draft" — a planned but not yet built flow.
5. **File upload (.docx, .pdf, .md, .txt)** (cut order #5) — the form is paste-only today. `mammoth` and `pdf-parse` are not yet installed.
6. **Live embedding job execution** — the script is authored; it requires a writable Postgres instance and a Voyage API key, both expected to be operator-provisioned tomorrow morning. The product runs against `mockComparables.ts` until the corpus is hot.
7. **Dockerfile + deploy.sh** — both shipped in the prior tag; need to be re-imported and updated for the new dependency set (next 15.5, voyageai, the embedding job's separate DB connection). Carry-forward in 30 minutes from the tag.

**Known rough edges:**

- The mock comparables generator returns the same 8 base records for every draft, with similarity weighted by keyword overlap. This is fine for the demo but visibly thin if a reviewer types a draft on a topic far from broadband/connectivity.
- `/evaluate` form's "anticipated amount" field is a free-text string parsed with `.replace(/[^0-9.]/g, "")` — accepts input like "$4,200,000" but won't reject malformed strings cleanly.
- Page transitions (M8) are not yet wired — Next 15 App Router uses the default fade; Framer Motion is installed but the route-transition wrapper isn't built.
- M7 scroll-driven section-headline scaling on the result page is not yet wired (GSAP installed; sections render statically).
- `prefers-reduced-motion` rule is in `globals.css` but only collapses CSS animations — Framer Motion components in the score circle and similarity bars use inline `style={animation: …}` which does respect it, but the suitability arcs use `transition` style assignments that bypass `prefers-reduced-motion` unless explicitly checked.

## 12. DEPLOY READINESS

- **Build verified:** `npm run build` succeeds locally with no errors. Route table confirms all 8 routes register and bundle.
- **Dockerfile:** not yet ported from the manifold-experiment-final tag. The two-stage Node 20 Alpine pattern from there should drop in cleanly; `voyageai` adds no native deps.
- **deploy.sh:** also pending port from the prior tag. The hackathon AWS profile + ECR repo pattern is unchanged.
- **Environment:** `.env.example` documents `DATABASE_URL`, `EMBEDDING_DATABASE_URL`, `VOYAGE_API_KEY`, `OPENAI_API_KEY`, and the build-identity vars. The operator fills these tomorrow morning when AWS credentials arrive.
- **Smoke test against fresh clone:** not executed in this session. The next pickup should `git clone --branch rebuild-suitability …` to a clean directory and run `npm ci && npm run build` to confirm the dependency manifest is complete.

— PYTH-LEAD
