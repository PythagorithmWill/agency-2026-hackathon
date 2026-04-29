# Agency 2026 Hackathon — Pythagorithm Build

**Event:** Agency 2026 Hackathon, Ottawa, April 29, 2026
**Operator:** Will Coffey, Pythagorithm AI Governance Solutions
**Repo upstream:** GovAlta/agency-26-hackathon

---

## What this project is

A one-day build for the Agency 2026 hackathon producing three live surfaces on top of the Government of Alberta's prepared analytics platform:

1. **The Glass Box** — accountability scoring engine where every finding carries a Pythagorithm Proof badge with full reasoning trace.
2. **Outcome Brief** — for any grant >$1M with no description, generate a one-page synthesized brief from AG reports, DRRs, Hansard, and news, with full citations.
3. **Counterfactual Brief** — for any grant missing a description, retrieve 8-15 nearest comparable grants with descriptions, plus parent-program DRR and AG findings, and synthesize "briefs in this category typically state X, Y, Z."

Stretch (in this order if cycles permit): **Citizen Lookup** (postal-code rollup), then **The Triangle** (lobbying × donations × grants timeline).

## Architectural framing

This build adopts three primitives from the **Intelligence Manifold** (Alford, Position Paper, February 2026 — intelligencemanifold.com):

- **Strata** — agents are scoped by informational density of what they touch
- **Strands** — Pythagorithm Proof tokens are provenance strands carrying the tier-by-tier reasoning trace from outer-stratum claims to inner-stratum sources
- **Bounded perception** — each agent's context is structurally scoped, not policed at runtime

We are **using the discipline**, not implementing the full geometric/physics-based system. If asked, that is exactly what we say.

## How agents are organized

```
S₁ (outer / lightest) — Episodic / task state
  └─ pyth-lead          Orchestrator, schedule, scope cuts
S₂ — Procedural
  ├─ pyth-demo          Demo choreography, dress rehearsal
  ├─ pyth-ops           AWS deployment, failover infrastructure
  ├─ pyth-fe            Frontend, three surfaces, Strand animation
  └─ pyth-backup        Failover execution, pre-cached outputs
S₃ — Semantic
  ├─ pyth-syn           Synthesis prompt engineering (Briefs)
  └─ pyth-gov           Calibrated-language validation, Proof token gates
S₄ — Source-linked
  ├─ pyth-db            Database queries, view discipline
  └─ pyth-res           External retrieval (AG/DRR/Hansard/news)
S₅ (inner / densest) — Archival
  └─ (delegated reads only — no resident agent)
```

`pyth-lead` is the **task agent** — not bound to a stratum, descends along provenance strands when needed, aggregates results upward.

Subagent definitions live in `.claude/agents/`. Each one is loaded by Claude Code when its capabilities are invoked.

## How skills are organized

Skills in `.claude/skills/` auto-load when relevant:

- **agency2026-data-skill** — schema, joins, data quality landmines (KNOWN-DATA-ISSUES F-3, A-13, A-10, C-7), pre-computed analysis tables, canonical SQL patterns. Loads when any agent touches the database.
- **pythagorithm-proof-token-skill** — canonical JSON schema for Proof tokens with all 4 tiers. Loads when any agent produces a finding.
- **calibrated-accountability-language-skill** — do/don't lexicon, forbidden phrase patterns, validator prompt. Enforced by pyth-gov.

## The non-negotiables

These come from PROJECT-RULES.md (also in this directory). Quick reference:

- **Runtime:** Node 18+, Python 3.10+, Postgres 14+ with pg_trgm
- **Database access:** read-only against hosted DB; no INSERT/UPDATE/DELETE/CREATE/DROP on the hackathon Postgres
- **Use pre-computed views:** `fed.vw_agreement_current` (NOT raw `agreement_value`), `general.golden_records`, `general.entity_loops`, `cra.t3010_violations`. Always dedupe AB on documented tuple. Year alignment: April 1 – March 31, end-year label.
- **Citation discipline:** every claim shown to a user carries a row reference, a Proof strand, or an explicit "cannot be sourced" marker. No fabrication.
- **Calibrated language:** "dataset shows" not "government failed." "Pattern consistent with X" not "evidence of fraud." pyth-gov runs the validator on every output.
- **Do NOT in the demo or UI:** no GovCore, AIOS internals, ServiceNow Build Partner status, SDVOSB, Carahsoft. Pythagorithm Proof Methodology may appear as a visible primitive, never as a logo or pitch.

## Tech stack

Lock the *outcomes*, not always the implementation. If conditions change tomorrow (e.g., AWS hands you a specific instance), adapt the implementation while preserving these outcomes:

| Layer | Default | The outcome that matters |
|---|---|---|
| Runtime | Node 20 LTS + Next.js 15 App Router | Streaming SSR for Brief outputs |
| Styling | Tailwind v4 with `@theme` block | Custom type scale + color system, no off-the-shelf component libraries |
| Type | General Sans (body) + Fraunces (display) + JetBrains Mono (data) | Editorial typography, not SaaS-dashboard typography. No Inter, no Roboto. |
| Mode | **Dark, committed** — warm dark (`#1A1816` ink) | One mode, confidently chosen. No toggle. |
| Color | Ink, Paper, Vellum, Ember, Sage, Rule | Three-color discipline plus two signal colors (ember=HIGH, sage=cleared) |
| Motion | Framer Motion + D3 for Strand and Strata Panel | Motion only when revealing something new. No ambient parallax. |
| Charts | Recharts + D3 for signature visualizations | The Strand draws. The Strata Panel breathes. Nothing else moves. |
| Icons | Lucide utility + custom SVG glyphs for domain entities | Custom glyphs (charity/grant/lobbying/donation) separate us visually |
| LLM (primary) | Bedrock: Claude Opus 4.6 (synthesis) + Sonnet 4 (classification) | Hackathon-provided account; both models accessed via `anthropic.claude-opus-4-6-20250514-v1:0` and `anthropic.claude-sonnet-4-20250514-v1:0` |
| LLM (failover) | Anthropic API direct (Pythagorithm production keys) | If Bedrock 5xx, swap. May use newer model versions; behavior is consistent. |
| Agent runtime | **Custom Claude Code orchestration. NOT Bedrock AgentCore.** | We keep orchestration in our own code so the calibrated-language gates and Proof token construction remain visible. AgentCore would obscure that. |
| Agent framework | Strands Agents SDK as a library (PYTH-RES, PYTH-DB) | Library = yes. Runtime = no. The distinction matters. |
| Cloud | **Hackathon-provided AWS account, region `ca-central-1`** | Will receives credentials at event start. Pre-event AWS work is smoke testing only. |
| Secrets | AWS Systems Manager Parameter Store (in provided account) | Never `.env` files committed to git |
| Pre-event SQL | Kiro (1000 credits per team) writes canonical queries tonight | One-time efficiency win. Day-of, agents read from `/sql/canonical/` not from Kiro live. |
| Auth | None | Every screen is the demo |

## Day-of timeline

| Time | Block | Outcome |
|---|---|---|
| 08:00–08:30 | Setup, preflight, smoke tests | All preflight checks green |
| 08:30–10:00 | Glass Box (#1) findings layer | Risk-scored entity feed live, Proof drawer renders |
| 10:00–11:30 | Outcome Brief (#2) synthesis | 5 pre-canned outcome briefs render with citations |
| 11:30–13:00 | Counterfactual Brief (#4-CF) | 3 working counterfactual briefs render |
| 13:00–13:30 | Lunch + walk the floor | Listen, learn what other teams built |
| 13:30–14:30 | Polish + integrate + Strand animation | All three surfaces from one URL; Strand working |
| 14:30–15:00 | Stretch 1: Citizen Lookup | Postal-code rollup if time permits |
| 15:00–15:30 | Stretch 2: Triangle (only if Citizen Lookup shipped) | Lobbying timeline if cycles |
| 15:30–16:30 | Demo dry-run + hardening | Three full passes through demo with team |
| 16:30+ | Demo time | Will presents |

## Escalation gates

`pyth-lead` cuts scope at each gate. Cut order: Triangle → Citizen Lookup → Counterfactual breadth → Outcome Brief breadth → Glass Box breadth. **Glass Box correctness and Proof tokens never cut.**

| Gate | Question | Cut if |
|---|---|---|
| 11:30 | Is Glass Box demo-able end-to-end? | If no, cut Counterfactual breadth, focus on getting Glass Box solid |
| 14:00 | Is Counterfactual Brief returning a real one-pager? | If no, cut both stretches, polish what works |
| 15:30 | Is the dress rehearsal clean? | If no, no new features — only fix existing ones |

## What "done" means

- All three surfaces accessible from one URL
- 10+ findings render in Glass Box with working Proof Drawer
- 5+ Outcome Briefs render with cited paragraphs
- 3+ Counterfactual Briefs render with comparable-grants panel
- The Strand animation works and is satisfying to click repeatedly
- Print preview of any Brief is publication-quality
- 30 cached pages live at `/cached/{slug}/...` for failover
- Verbal SDTC fallback rehearsed
- Will has memorized the 90-second pitch

---

**For the human reading this in Claude Code:** if you're picking up this project mid-stream, read this file, then read PROJECT-RULES.md, then DESIGN-SYSTEM.md, then look in `.claude/agents/` for the role you're playing. Each subagent file specifies its stratum, bounded perception, and definition of done.

**For autonomous overnight operation:** read AUTONOMOUS-EXECUTION.md before any other action. It defines the loop conditions, quality gates, hard guardrails, and stopping criteria for hands-off operation.
