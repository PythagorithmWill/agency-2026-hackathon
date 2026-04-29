# Agency 2026 Hackathon — Pythagorithm Build

A one-day build for the **Agency 2026 Hackathon** in Ottawa (April 29, 2026), produced by Pythagorithm AI Governance Solutions.

Three live surfaces on top of the Government of Alberta's prepared analytics platform:

1. **The Glass Box** — accountability scoring engine where every finding carries a Pythagorithm Proof badge with full reasoning trace.
2. **Outcome Brief** — for any grant >$1M with no description, generate a one-page synthesized brief from AG reports, DRRs, Hansard, and news, with full citations.
3. **Counterfactual Brief** — for grants missing descriptions, retrieve 8–15 nearest comparable grants with descriptions, plus parent-program DRR and AG findings, and synthesize what briefs in this category typically state.

## Architectural framing

This build adopts three primitives from the *Intelligence Manifold* (Alford, Position Paper, February 2026 — intelligencemanifold.com):

- **Strata** — agents are scoped by informational density of what they touch.
- **Strands** — Pythagorithm Proof tokens are provenance strands carrying tier-by-tier reasoning traces.
- **Bounded perception** — each agent's context is structurally scoped, not policed at runtime.

We are using the discipline, not implementing the full geometric system.

## Repository layout

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Root orchestrator spec |
| `AUTONOMOUS-EXECUTION.md` | Overnight operating playbook |
| `PROJECT-RULES.md` | The non-negotiables (R1–R10) |
| `DESIGN-SYSTEM.md` | Canonical UI/UX guide |
| `.claude/agents/` | Per-stratum subagent definitions |
| `.claude/skills/` | Auto-loading data + governance skills |
| `docs/` | Strategic briefing, PRD, Architecture spec, Engineering Playbook, Test Plan |
| `src/` | Next.js 15 App Router application |
| `sql/canonical/` | Reviewed canonical SQL queries |
| `scripts/` | Prewarm cache, deploy, failover scripts |
| `cached/` | Pre-rendered HTML pages for failover |

## Tech stack (locked outcomes)

- **Runtime:** Node 20 LTS + Next.js 15 App Router (streaming SSR for Brief outputs)
- **Styling:** Tailwind v4 with `@theme` block; editorial dark, warm palette
- **Type:** General Sans (body) + Fraunces (display) + JetBrains Mono (data)
- **LLM (primary):** AWS Bedrock — Claude Opus 4.6 (synthesis) + Claude Sonnet 4 (classification)
- **LLM (failover):** Anthropic API direct
- **Agent runtime:** Custom Claude Code orchestration (deliberately not Bedrock AgentCore)
- **Cloud:** Hackathon-provided AWS account, region `ca-central-1`
- **Auth:** None — every screen is the demo

## Day-of timeline

See [`CLAUDE.md`](CLAUDE.md) for the locked schedule and escalation gates.

## License

MIT — see [`LICENSE`](LICENSE).

## About

Built by Pythagorithm AI Governance Solutions for the Government of Alberta's Agency 2026 hackathon, hosted at Communitech in Ottawa, April 29, 2026.
