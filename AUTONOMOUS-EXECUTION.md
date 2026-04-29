# Autonomous Execution Playbook

**Owner:** PYTH-LEAD
**Loaded by:** Claude Code on session start
**Purpose:** Operate hands-off through the night, completing as much of the build as possible without human intervention while preserving safety, quality, and recoverability.

---

## Operating mode: autonomous, with guardrails

This is an **overnight build session**. The operator (Will) will start Claude Code, kick off the orchestration prompt, and sleep. The session must:

- Continue working without stopping for routine confirmations
- Test, lint, security-scan, and self-review every meaningful change
- Fix bugs and remediate issues as they arise
- Document every decision in `decisions.md`
- Stop ONLY for: blockers requiring human judgment, irreversible operations, exhaustion of meaningful work, or hard guardrail violations

The objective is not "build forever" — it is "complete the realistic scope of tonight's work and stop cleanly."

## What "without stopping" actually means

Claude Code has tools for code execution, file editing, web fetch, and shell. PYTH-LEAD will use them in a continuous loop:

```
LOOP {
  read PROJECT-RULES.md and the active task list
  pick the next highest-priority task
  delegate to the appropriate subagent (or execute directly)
  validate output (tests, lints, security scan, citation check)
  on validation failure: fix it, re-validate, log to decisions.md
  on validation pass: commit, update task list, log progress
  if blocker encountered: write to BLOCKERS.md, skip task, continue
  if no remaining tasks at acceptable quality: stop cleanly
}
```

The loop runs against a prioritized task list (see §3). It does not require human approval for individual edits within scope. It does require human approval for the things in §5.

## Priority-ordered task list (work this in order)

PYTH-LEAD works through the list top-down. Within each priority tier, tasks may run in parallel where they don't conflict on file paths.

### P0 — Must complete before anything else (foundation)
1. Verify direct Render Postgres connection — confirm view counts (`general.golden_records ~793K`, `fed.vw_agreement_current ~1.275M`, `cra.t3010_violations ~55K`, `general.entity_loops 5,808`). If wrong, write to BLOCKERS.md and STOP — Will needs to verify the schema matches expectations before proceeding.
2. Run `.local-db/import.js` to load failover copy in the background
3. Scaffold Next.js 15 project with TypeScript, Tailwind v4, App Router
4. Install General Sans + Fraunces + JetBrains Mono; paste `@theme` block into globals.css
5. Configure pg pool with the connection string from PYTH-DB §"Database connection convention"
6. Build the layout shell (ink background, paper text, three navigation routes)
7. Stub three surface routes with placeholder content

### P1 — Critical-path build (everything the demo must do)
1. PYTH-DB writes canonical SQL queries via Kiro, saves to `/sql/canonical/` (with all landmine warnings in every prompt)
2. PYTH-RES populates `citation_registry` with the 6 Glubish-named entities (AG findings, DRRs)
3. PYTH-RES populates `gc_aia_register` with 10 federal AIAs (priority list in PYTH-RES)
4. PYTH-DB runs `scripts/prewarm-cache.js` to generate `cache/seed-entities.json`
5. PYTH-FE builds `FindingsCard` component
6. PYTH-FE builds `ProofBadge` component (sage/ember based on token state)
7. PYTH-FE builds `ProofDrawer` slide-up panel rendering 4-tier output
8. PYTH-FE builds the Strand SVG animation (D3, cubic-bezier easing, paper-to-ember on HIGH)
9. PYTH-FE builds the Glass Box findings feed (virtualized list + sort/filter/search)
10. PYTH-FE builds the AIA Register panel reading from `gc_aia_register`
11. PYTH-FE builds the Outcome Brief layout (Fraunces headline, marginal citations, Proof token strip)
12. PYTH-FE builds the Counterfactual Brief layout (extends Outcome Brief + comparable-grants panel)
13. PYTH-SYN finalizes synthesis prompts, tests against 3 known cases manually
14. PYTH-GOV implements the three-check validator pipeline (citation completeness, calibrated language regex, Proof token completeness)
15. PYTH-OPS writes Dockerfile + deployment script + `failover-to-local.sh` + `failover-llm-to-bedrock.sh`

### P2 — Quality and resilience
1. Run full test suite (component tests, integration tests, calibration tests from §2 of Test Plan)
2. Run security scan: dependency audit (`npm audit`), secret scanning, no committed credentials
3. Generate 10 pre-cached briefs (6 Outcome + 4 Counterfactual) and store in `/cached/`
4. Generate the screen recording fallback (run the demo flow once, capture)
5. Run dress-rehearsal automation: scripted click-through of full demo, verify all assertions pass
6. Run failover rehearsal: deliberately break each connection, verify recovery <30 seconds

### P3 — Stretch, only if P0-P2 complete
1. Citizen Lookup surface (postal-code aggregation)
2. The Triangle (lobbying × donations × grants timeline) — only if Citizen Lookup ships
3. Custom SVG glyphs for 5 entity types (charity, federal grant, AB grant, lobbying, donation)
4. Strata Panel D3 component (concentric arcs)

### P4 — Polish (luxury, only if everything else is done)
1. Print-preview QA at A4 for all Brief surfaces
2. Dark-mode visual QA across all components
3. Mobile-responsive QA (Will may need to demo from his phone)
4. Performance profiling and optimization pass

## Continuous quality gates

Every meaningful change must pass all four gates before the next task starts:

### Gate 1 — Build & lint
- `npm run build` succeeds with no errors
- `npm run lint` produces no errors (warnings acceptable but logged)
- TypeScript strict mode passes

### Gate 2 — Tests
- All existing tests still pass
- New components have at least one render test
- New API routes have at least one integration test
- Calibration test cases (from Test Plan §2) all behave as documented

### Gate 3 — Security
- `npm audit` shows no high/critical vulnerabilities (moderate acceptable, logged)
- No secrets in committed files (regex scan: `(api[_-]?key|secret|password|bearer)[^a-z0-9]+[a-z0-9]{16,}`)
- No `eval()`, no unsafe `dangerouslySetInnerHTML`, no `dangerously` patterns
- Database queries use parameterized statements (no string concatenation into SQL)

### Gate 4 — Calibration
- Any user-facing copy passes the calibrated-language regex sweep (PYTH-GOV)
- Proof tokens validate against the canonical schema
- Citations resolve to actual rows in `citation_registry`

**On gate failure:** PYTH-LEAD attempts to fix the failure (up to 3 attempts). If still failing, logs to `BLOCKERS.md` with diagnostic details and continues with non-conflicting tasks.

## What to STOP for (hard guardrails — wake the operator)

PYTH-LEAD must stop and write a clear status to `WAKE-OPERATOR.md` ONLY for:

1. **Direct Render Postgres connection fails or view counts don't match** — schema may differ from documented expectations
2. **Anthropic/Bedrock LLM calls fail >5 times in a row** — credentials problem
3. **Any operation that would cost >$50** — cost guardrail
4. **Any deployment to AWS** — Will should be present for first deploy verification
5. **Any operation that would expose credentials** — secret scan caught something
6. **Any data write to the hackathon Postgres DB** — it's read-only by policy
7. **The build is fundamentally blocked and no progress is possible on any task**
8. **Quality gates fail repeatedly on multiple unrelated tasks** — environment problem

If any of these trigger: write `WAKE-OPERATOR.md` with:
- The trigger condition
- Diagnostic information
- What's already complete
- Recommended next step
- Estimated impact on demo readiness

PYTH-LEAD does NOT stop for routine things: a single failing test, a flaky network call, an awkward layout, an ambiguous requirement (default to PROJECT-RULES, log decision to `decisions.md`, continue).

## Decision logging

`decisions.md` records every non-trivial choice. Format:

```
## [HH:MM] — [Subject]
**Decision:** What was chosen
**Reason:** Why
**Alternatives considered:** Other options
**Reversibility:** Easy / Hard / Irreversible
**Owner:** Which agent
```

This is the morning briefing for Will — a complete log of what happened while he slept.

## Progress tracking

`PROGRESS.md` is updated every 30 minutes with:
- Tasks completed since last update
- Tasks in progress
- Tasks blocked (and why)
- Estimated remaining work

`BLOCKERS.md` lists every issue that couldn't be resolved autonomously, with diagnostic information.

## Self-review pattern

Every 90 minutes, PYTH-LEAD performs a self-review:
1. Read the last 90 minutes of `decisions.md`
2. Check if any decisions look wrong in retrospect
3. Verify the build is still consistent with PROJECT-RULES.md
4. Verify no calibration leaks have been introduced
5. Re-prioritize remaining tasks if context warrants

If the self-review surfaces a problem: log to `decisions.md`, fix it, continue.

## Stopping conditions

PYTH-LEAD stops cleanly when ANY of these is true:

1. All P0-P2 tasks are complete to acceptance criteria
2. The clock reaches 06:30 EDT (Will needs to wake at 7:00 to leave for the venue)
3. A hard guardrail (§5) is triggered
4. No meaningful task can make progress without human input

On clean stop, PYTH-LEAD writes `MORNING-BRIEFING.md`:
- Build status (P0/P1/P2/P3/P4 completion percentage)
- Quality gate status
- Any pending blockers
- Recommended day-of priorities
- Demo URL (if deployed) or staged-but-not-deployed status
- Time used vs time available

## What this is not

- This is not a license to make architectural decisions without consulting PROJECT-RULES.md
- This is not a license to skip the calibration discipline (PYTH-GOV runs on every output)
- This is not a license to write code that hasn't been reviewed against the agent specs
- This is not a license to deploy to production without human approval

The autonomy applies to *execution*, not to *direction*. The direction is locked in PROJECT-RULES.md, the agent files, and this playbook.
