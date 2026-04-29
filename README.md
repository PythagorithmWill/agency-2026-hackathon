# Glassbox

**See through the spend.**

Prospective accountability for federal and Alberta provincial spending. Glassbox surfaces duplication, recipient concentration, and language-calibration issues during drafting — not after audit.

The product is transparent about what it sees AND about its own reasoning. Both senses of "glassbox."

---

## What it does

| Surface | Purpose |
|---|---|
| **`/`** | Marketing-grade homepage. Hero, three explainer cards, the "Three checks. One score." reveal, audit-trail two-column section, by-the-numbers row, methodology preview, footer. |
| **`/search`** | Hybrid-keyword retrieval against three corpora simultaneously: `fed.grants_contributions`, `ab.ab_grants`, `ab.ab_contracts`. Per-source breakdown chip ("8 federal · 3 AB grants · 1 AB contract"). |
| **`/evaluate`** | Paste a draft solicitation, get a four-component suitability score (uniqueness, duplication risk, recipient concentration, language calibration), comparable records, recommended verdict (PROCEED / CONSOLIDATE / DECLINE AS DUPLICATIVE). |
| **`/evaluate/[id]`** | The result page. Suitability score circle + 4-arc reveal, comparable record cards with source badges, recipient-concentration stacked bar, inline language audit with hover tooltips, audit token strip, methodology footer CTA. |
| **`/record/[source]/[recordId]`** | Single-record detail with source badge, full description, federal-only amendment-chain timeline (notches plot left-to-right on viewport entry; line height = dollar value at that amendment), related records, cite-as line. |
| **`/methodology`** | The substance behind the surface. Calibrated language regex set + try-it-yourself validator. Citation discipline tiers. Audit token JSON typewriter. AIA structural correspondence table. Data landmines (F-1, F-3, A-13, A-10, A-6, C-7). The five agents diagram. |
| **`/verify/[proofId]`** | Independent re-run of `proofTokenCompleteness` against any downloaded audit token. Tier-by-tier verdict + violations list. |
| **`/api/health`** | Per-source health probe used by ops + the footer status pill. Returns `503` when any source is down. |
| **`/api/draft/evaluate`** | POST a draft submission, get an `evaluationId`. |
| **`/api/proof/[proofId]/download`** | Pretty-printed audit-token JSON with `_verifiability` footer block. |

## Architecture (text diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                         glassbox UI                             │
│  Next.js 15 App Router · Tailwind v4 · Inter / JetBrains Mono   │
│  Framer Motion (component) · GSAP (post-hackathon scrollytell)  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       retrieval pipeline                         │
│                                                                 │
│   tsquery(...)                                                  │
│       │                                                         │
│       ▼                                                         │
│   Promise.allSettled([fed_FTS, ab_grants_FTS, ab_contracts_FTS])│
│       │                                                         │
│       ▼                                                         │
│   max-normalised ts_rank_cd → ComparableRecord[]                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               PYTH-GOV (calibrated language gate)                │
│   FORBIDDEN_ABSOLUTE + FORBIDDEN_CAUSAL regex sweep             │
│   Audit token completeness check                                │
│   Locked: 18 anchor cases (10 reject + 8 accept)                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    suitability scoring engine                    │
│   uniqueness · duplication risk · recipient concentration ·    │
│   language calibration   →   composite 0–30   →   verdict       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   audit token (sealed sha256)                    │
│   tier 1 input · tier 2 contextual · tier 3 output · tier 4 audit│
│   downloadable JSON · independently verifiable at /verify/[id]  │
└─────────────────────────────────────────────────────────────────┘
```

## Data sources

| Source | Table | Rows | Landmine guards |
|---|---|---|---|
| Federal | `fed.grants_contributions` | ~1.27M | F-1 (ref_number collisions), F-3 (cumulative agreement_value via DISTINCT ON CTE), F-6/F-7 (BN format) |
| Alberta grants | `ab.ab_grants` | ~1.99M | A-13 (dedupe on full tuple), A-10 (recipient IS NOT NULL), A-6 (drop reversal/correction rows) |
| Alberta contracts | `ab.ab_contracts` | ~67K | A-13 + A-10 |
| Entity registry | `general.entity_golden_records` | ~851K | Anchor on BN where available |
| CRA loop universe | `cra.loop_universe` | ~1.5K | Pre-computed per-bn loop scores |

All guards documented in [`agency2026-data-skill.md`](.claude/skills/agency2026-data-skill.md).

## Local dev

```bash
# 1. install
npm install

# 2. .env.local — populate from .env.example
cp .env.example .env.local
$EDITOR .env.local
# DATABASE_URL pointing at the Render replica is the only required value

# 3. dev server
npm run dev
# open http://localhost:3000

# 4. tests
npm test               # 41 passing — calibration + suitability + retrieval + routes
npx tsc --noEmit       # strict TypeScript, 0 errors
```

## Production build

```bash
npm run build
npm start
```

The `output: 'standalone'` flag in `next.config.ts` produces a self-contained server in `.next/standalone/server.js` for the Docker runtime.

## Docker

```bash
cd infra
docker compose up --build
# open http://localhost:3000
```

Reads `../.env.local` for `DATABASE_URL`. The container has a `HEALTHCHECK` that pings `/api/health` every 30 seconds.

## AWS deploy

See [`infra/aws/README.md`](infra/aws/README.md). The short version:

```bash
export AWS_ACCOUNT_ID=…
export AWS_REGION=ca-central-1
export ECR_REPO_URL=…
./infra/aws/deploy.sh
```

The script builds the image with the git SHA + ISO timestamp baked in, pushes to ECR, registers a new ECS task-definition revision, triggers a rolling update on `glassbox-web`, and probes `/api/health` on the ALB before declaring success. CI/CD pipeline at `.github/workflows/deploy.yml`.

## Methodology

Open. Reproducible. Auditable.

- Calibrated language: locked regex set ([`src/lib/gov/validators.ts`](src/lib/gov/validators.ts)). 11 forbidden patterns (7 absolute + 4 causal). 18 anchor test cases (10 reject + 8 accept). Visible at [`/methodology`](src/app/methodology/page.tsx).
- Citation discipline: every prose claim ships with at least one source pointer. Direct quotes capped at 15 words. One direct quote per source max. Authority tier scale 1 (Auditor General) → 4 (other news).
- Audit tokens: every output sealed with sha256 hash chained to its parent. Four-tier gate sequence (input filtering, contextual modeling, output gating, audit sealing). Downloadable JSON. Verify any token at `/verify/[proofId]`.
- Built on the **Pythagorithm Proof Methodology v1.0** — see the [methodology page](src/app/methodology/page.tsx) for the full schema and the federal AIA structural correspondence.

## Repository

| Path | Purpose |
|---|---|
| `src/app/` | Next.js routes |
| `src/components/` | UI components — brand, home, evaluate, methodology, record, motion primitives |
| `src/lib/db/` | pg pool, healthcheck |
| `src/lib/evaluate/` | retrieval (multi-source FTS), buildResult, mockComparables fallback, store |
| `src/lib/gov/` | validators (calibration sweep + audit-token completeness) |
| `src/lib/suitability/` | scoring engine + 18 unit tests |
| `src/lib/types.ts` | canonical types: ComparableRecord, EvaluationResult, AuditToken, etc. |
| `infra/` | Dockerfile, docker-compose, AWS task-definition, deploy.sh, CloudFront config |
| `.github/workflows/` | deploy.yml — CI/CD |
| `.claude/agents/` | five-agent orchestration spec |
| `.claude/skills/` | calibrated language, agency2026 data, audit-token schema |
| `docs/PRD.md` | product source of truth |
| `docs/DESIGN-SYSTEM.md` | locked design language |

## License

MIT — see [`LICENSE`](LICENSE).
Copyright © 2026 **Pythagorithm AI Governance Solutions**.

## Built for

Agency 2026 Hackathon · Ottawa · April 29, 2026.
