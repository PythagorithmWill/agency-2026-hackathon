# Changelog

All notable changes to Glassbox.

## [0.3.0] — 2026-04-29 (Glassbox rebuild)

### Brand pivot

- Wholesale rebrand from internal "Pythagorithm" naming to **Glassbox**, the federal+provincial spending accountability product.
- Pythagorithm AI Governance Solutions remains the parent company / methodology IP holder. Pythagorithm Proof Methodology attribution survives only in three places: the methodology cite-as line, the homepage footer attribution band, and the audit-token JSON `_verifiability` block.
- New `GlassboxMark` SVG logo (square frame + 3 hairlines + accent dot) and `GlassboxWordmark` (lowercase with the "o" rendered as a perfect lens-circle in `--color-accent`).
- New tagline: **"See through the spend."**
- New positioning sentence: "Glassbox surfaces duplication, recipient concentration, and language-calibration issues during drafting — not after audit. Federal grants and contributions. Alberta provincial spending. One transparent view."

### Data sources

- **Wired Alberta provincial sources into retrieval** — `ab.ab_grants` (1.99M rows) and `ab.ab_contracts` (67K rows) now query in parallel with `fed.grants_contributions` (1.27M rows) on every search and every evaluate.
- Each source applies its own landmine guards:
  - Federal: F-3 max-amendment CTE
  - AB grants: A-13 dedupe + A-10 recipient NULL filter + A-6 negative-amount (reversals) drop
  - AB contracts: A-13 + A-10
- Synthesised search text for the AB tables (no description column on either): `program||recipient||ministry` for grants; `recipient||ministry` for contracts.
- ts_rank_cd globally max-normalised so similarity bars are comparable across sources.

### Visible additions

- `SiteHeader` — sticky-on-scroll site header. Transparent over the hero; transitions to bg-elev-1 with backdrop-blur and 1px border past 80px scroll.
- `SourceBadge` — small mono pill on every retrieved record card ("FED" cyan / "AB · GRANT" amber / "AB · CONTRACT" warmer amber).
- `SourceBreakdown` — "8 federal grants · 3 AB grants · 1 AB contract" caption row on `/evaluate/[id]` and `/search`.
- `DataSourceStatusPill` — footer status indicator that pings `/api/health` on mount.
- New route: `/record/[source]/[recordId]` with source-aware header, full description, federal-only amendment-chain SVG timeline (notches plot left-to-right on viewport entry, line height = dollar value at that amendment, hover for delta tooltip), related-records panel.
- New route: `/api/health` — per-source health probe returning rows, latest_fy, status, latencyMs per source.

### Infrastructure

- `next.config.ts` — `output: 'standalone'` for the Docker runtime.
- `infra/Dockerfile` — multi-stage Node 20 Alpine build, drops to non-root nextjs user, `HEALTHCHECK` directive against `/api/health`.
- `infra/docker-compose.yml` — local prod-mode test target.
- `infra/aws/task-definition.json` — ECS Fargate task-def with placeholders for `__AWS_ACCOUNT_ID__`, `__ECR_REPO_URL__`, `__IMAGE_TAG__`. CloudWatch logs + Secrets Manager DATABASE_URL + healthcheck.
- `infra/aws/deploy.sh` — idempotent build → push to ECR → render task-def → register revision → force-new-deployment → wait for stable → smoke-test `/api/health` on the ALB.
- `infra/aws/cloudfront-config.json` — distribution config (HTML no-cache, `/_next/static/*` 1-year cache, `/api/*` no-cache, redirect-to-https).
- `infra/aws/README.md` — full provisioning order, GitHub Actions secrets list, cost estimate ($60-90/mo light load), failover modes, rollback procedure.
- `.github/workflows/deploy.yml` — CI/CD pipeline (test → build → docker → ECR → ECS update).

### Cleanup

- Removed unused per-page `<header>` strips (replaced by global `SiteHeader`).
- Removed unused `Link` imports in pages that no longer reference any internal Link.
- Removed legacy `Pythagorithm` strings from user-facing UI (page titles, headers, body copy).

### Tests

- 41/41 passing — 18 calibration + 18 suitability + 2 route-existence + 3 searchCorpus signature.
- `searchCorpus` test suite updated for the new `SearchResult` return shape.

---

## [0.2.0] — 2026-04-29 (visual rebuild — Pythagorithm era)

- Homepage rebuild as 7-section marketing surface: hero, explainer cards, ThreeChecksViz, AuditTrail two-column, ByTheNumbers, MethodologyPreview, footer.
- Methodology page scrollytelling: hero, JsonTypewriter, AnimatedAiaTable, AgentsDiagram, RegexCard hover.
- `/evaluate/[id]` motion polish: char-stagger header, score-circle count-up + scale pulse, comparable-cards stagger, proof-token tier-by-tier reveal.
- Locked design tokens: `--color-bg #0A0A0A`, `--color-fg #FAFAFA`, `--color-accent #5EEAD4`.
- Inter Variable + JetBrains Mono via `next/font`.
- Framer Motion + GSAP installed.

## [0.1.0] — 2026-04-29 (orphan rebuild — Manifold experiment decommissioned)

- Wholesale pivot from the 3D Manifold experiment to the prospective-accountability product.
- Carry-forward: SQL canonical queries, db pool, calibration validators, audit-token primitives, custom SVG glyphs.
- New: PRD, DESIGN-SYSTEM, 5 agent specs, 3 skills, types, suitability engine, evaluate flow, methodology page.
- Real federal retrieval against `fed.grants_contributions` with the F-3 max-amendment CTE pattern.

## v1-flat-stable / manifold-experiment-final

Tags preserved on the prior `main` head for full rollback into the Manifold-era state if ever needed.
