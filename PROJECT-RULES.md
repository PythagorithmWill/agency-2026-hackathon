# Agency 2026 Hackathon — Project Rules

**Version:** 1.0
**Date:** April 28, 2026
**Status:** Authoritative. Every agent CLAUDE.md must reference this file.
**Owner:** PYTH-LEAD

These rules are derived from the hackathon repo's prerequisites and from the constraints of a one-day build. They are **not suggestions**. Violations cost time we do not have.

---

## R1 — Runtime versions (hard floor)

| Component | Required | Rationale |
|---|---|---|
| Node.js | **18 or newer** (prefer 20 LTS) | Every module in the repo. Node 16 fails on `node --import` flags used in import scripts. |
| Python | **3.10 or newer** | Splink entity-resolution stage only. Type hints in repo code use 3.10+ syntax. |
| PostgreSQL | **14 or newer**, `pg_trgm` enabled | `pg_trgm` is required for fuzzy entity matching. Verify with `CREATE EXTENSION IF NOT EXISTS pg_trgm;` |
| Disk | **~20 GB free** | 13 GB JSONL bundle + loaded tables + indexes + Splink parquet (~60 MB transient) |
| RAM | **8 GB recommended** (4 GB floor) | Splink and LLM stages benefit from more. Other stages are light. |

### Pre-flight check (run before 08:00 tomorrow)

```bash
node --version            # must be v18.x or v20.x or newer
python3 --version         # must be 3.10+
psql --version            # must be 14+
psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" -d postgres
df -h .                   # confirm 20+ GB free
free -h                   # confirm 8 GB available (Linux) / vm_stat (Mac)
```

If any check fails, **escalate to PYTH-LEAD before doing anything else.** Do not attempt workarounds.

---

## R2 — Database access pattern

The hackathon repo provides two database access modes. We use them in this order:

1. **Primary: hosted Render Postgres** (read-only, provided by hosts)
2. **Fallback: local Postgres** loaded via `.local-db/import.js`

**Rule:** Every agent that runs SQL must work against **both** without code changes. Connection string is the only thing that varies. Do not hard-code the hosted URL anywhere except in environment config.

```bash
# Required environment variable
DATABASE_URL=postgres://...
```

**Rule:** All read queries must work against the read-only role. No agent attempts `INSERT`, `UPDATE`, `DELETE`, `CREATE`, or `DROP` on the hosted DB. If we need writable state (e.g., caching synthesis results), it goes in a **separate local SQLite or Postgres instance**, never the hackathon DB.

---

## R3 — Use pre-computed views, not raw tables

This is repeated from `agency2026-data-skill.md` because it is the single most expensive mistake we could make.

**Always use:**

- `fed.vw_agreement_current` — never raw `fed.agreements.agreement_value` (cumulative, not delta — see KNOWN-DATA-ISSUES F-3)
- `general.golden_records` for entity lookup — already resolved via Splink
- `general.entity_loops` — pre-scored, do not recompute
- `cra.t3010_violations` — pre-flagged, includes 54,010 arithmetic + 1,075 plausibility

**Always dedupe Alberta data on the documented tuple (KNOWN-DATA-ISSUES A-13).** AB roll-up rows (~$25B, A-10) must be excluded from totals — filter on the documented flag.

**Year alignment:** All fiscal years are April 1 – March 31, labeled by the **end year**. FY2024 = April 1, 2023 – March 31, 2024. Cross-dataset joins must align on this convention or numbers will be silently wrong.

---

## R4 — Versioning and reproducibility

Every artifact we ship — UI build, agent output, Proof token — carries:

- A git commit hash (`git rev-parse HEAD` at build time)
- An ISO 8601 build timestamp (UTC)
- A Proof token version (`v1.0` for tomorrow)

**Rule:** No "works on my machine" demos. If PYTH-DEMO can't run the demo against a fresh clone in 5 minutes from a documented `README.md`, the build is not done.

---

## R5 — Citation discipline (non-negotiable)

Every claim shown to a user in The Glass Box, Outcome Brief, or Citizen Lookup must carry one of:

1. A **direct row reference** — schema.table.row_id, column, value
2. A **provenance strand** — a Proof token entry pointing to the source dataset and pre-computed analysis table
3. An **explicit "cannot be sourced"** marker — no fabrication, no inference dressed as fact

If PYTH-SYN cannot produce a citation, the claim does not appear. See `calibrated-accountability-language-skill.md`.

---

## R6 — Calibrated language (non-negotiable)

- "The dataset shows..." not "The government failed..."
- "Pattern consistent with X" not "Evidence of fraud"
- "Score: HIGH (12/23 indicators)" not "Suspicious"
- Numerical scores must always carry their denominator and the indicator list
- No claim about a named person, organization, or program is published without (a) entity resolution confidence and (b) a human-review flag if confidence is below threshold

The PYTH-GOV agent runs the validator on every output before it leaves the synthesis stage.

---

## R7 — Manifold-aligned architecture

(See architectural framing section in the briefing.)

We are using three primitives from the Intelligence Manifold (Alford, 2026):

- **Strata** — agents are scoped by informational density of what they touch
- **Strands** — Pythagorithm Proof tokens carry provenance from outer-stratum claims to inner-stratum sources
- **Bounded perception** — each agent's context is scoped by what it owns, not what it could in principle access

We are **not** implementing the full geometric/physics-based manifold. We are adopting its discipline. If the audience asks, this is exactly what we say.

---

## R8 — Time discipline

- 08:30 — environment up, all preflight checks green
- 11:30 — Glass Box demo-able end-to-end (even if ugly)
- 14:00 — Outcome Brief returning a real one-pager for at least one grant
- 15:30 — Citizen Lookup queryable by postal code
- 16:00 — full demo dress rehearsal
- 16:30 — first walk-around

PYTH-LEAD has the authority to **cut scope at any escalation gate.** Cut order: Triangle stretch → Citizen Lookup polish → Outcome Brief breadth → Glass Box breadth. Glass Box correctness and Proof tokens never get cut.

---

## R9 — What we do not do

- **No password / OAuth / account creation flows.** If the hosted environment requires login, Will does it.
- **No file downloads** without explicit confirmation in chat.
- **No claims about named individuals** without entity-resolution confidence + human review flag.
- **No screenshots or output containing real PII** beyond what is already in the public datasets.
- **No mention of GovCore, AIOS internals, ServiceNow Build Partner status, SDVOSB, or Carahsoft in the demo or UI.** The Pythagorithm Proof Methodology may appear as a visible primitive (badge), never as a logo or pitch.

---

## R10 — Failure modes and fallback strategy

| Failure | Fallback |
|---|---|
| Hosted Postgres unavailable | Switch to local DB via `.local-db/import.js`. Already loaded by 08:00 tomorrow. |
| LLM API rate-limited or down | Cached synthesis outputs from rehearsal demo run at 16:00. Pre-record three Outcome Briefs. |
| Frontend deploy fails | Local Next.js dev server, screen-cast over Will's laptop. |
| Entity resolution disagreement | Show both candidate matches with their confidence scores. Do not pick one silently. |
| A claim cannot be cited | Remove the claim. Never fabricate a citation. |

Every fallback is rehearsed at the 16:00 dress rehearsal. PYTH-OPS owns the rehearsal checklist.
