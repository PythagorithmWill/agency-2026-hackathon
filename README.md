# Pythagorithm — Prospective Accountability for Federal Spending

Federal departments post billions in grants and contracts every year. **$71.5 billion of that spend has no public description.** Departments often fund work substantially similar to what is already funded. Solicitations frequently use language the Auditor General would later flag in audit. The decisions are accountable retrospectively, in audit, after money has moved.

There is no equivalent of the federal Algorithmic Impact Assessment for spending decisions — no prospective review at the moment of drafting. **This product is that review.**

A federal department pastes or uploads a draft solicitation before posting it. The system returns:

1. Similarity matches across the federal grants & contributions corpus and the Alberta provincial corpus, ranked by semantic and keyword retrieval
2. Awardee patterns — historical concentration, geographic distribution, departmental capture
3. Funding history — initial commitment vs. current commitment for every comparable record (amendment chain, F-3 corrected)
4. Calibrated language audit — phrases the AG would reject, with rewrite suggestions
5. A composite suitability score (0–30) across four dimensions: uniqueness, duplication risk, recipient concentration, language calibration
6. A recommendation: **PROCEED**, **CONSOLIDATE**, or **DECLINE AS DUPLICATIVE**

Every score, every match, every recommendation is wrapped in a Pythagorithm Proof token with full citation provenance and gate-by-gate audit trail.

A second surface — search — lets users query the corpus directly without uploading a draft. Same retrieval engine, different entry point.

## Repository layout

| Path | Purpose |
|---|---|
| `docs/PRD.md` | Source of truth for product scope and success criteria |
| `docs/DESIGN-SYSTEM.md` | Locked design language: color, type, spacing, motion |
| `.claude/agents/` | Five-agent orchestration spec |
| `.claude/skills/` | Calibrated language, agency2026 data, Pythagorithm Proof token |
| `src/app/` | Next.js 15 App Router |
| `sql/canonical/` | Hand-audited SQL with F-1, F-3, A-13, A-10, C-7 landmine guards |
| `scripts/` | Embedding job, DB verification, deploy + failover |

## Tech stack

- Next.js 15 App Router + React 19, TypeScript strict
- Tailwind CSS v4 with `@theme` block, dark editorial palette
- Inter Variable + JetBrains Mono via `next/font`
- Framer Motion (component animations) + GSAP / ScrollTrigger (scroll-driven sequences)
- PostgreSQL with `pgvector` for hybrid retrieval (BM25 + cosine)
- Voyage AI `voyage-3-large` (1024-dim) embeddings, with OpenAI / Cohere / Bedrock fallback chain
- AWS Bedrock primary for any LLM synthesis (region `ca-central-1`); Anthropic API direct as failover

## Status

This branch (`rebuild-suitability`) is an orphan — git history of the prior `manifold-experiment-final` tag is preserved. See `SESSION-4-PIVOT-REPORT.md` for the cutover narrative.

## License

MIT — see [`LICENSE`](LICENSE).
