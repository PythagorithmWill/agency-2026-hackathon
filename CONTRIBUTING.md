# Contributing to Glassbox

Glassbox is open-source MIT, but the demo cadence is tight and the design language is intentionally narrow. Drive-by PRs welcome; expect them to be triaged against the brief constraints.

## Code style

- **TypeScript strict.** No `any`, no `// @ts-ignore` without a comment explaining why.
- **No localStorage / sessionStorage / IndexedDB.** All UI state lives in React state.
- **No emoji** in user-facing strings, errors, loading states, or commit messages.
- **Calibrated language.** Every prose surface that PYTH-GOV inspects must pass the calibration sweep. See [`src/lib/gov/validators.ts`](src/lib/gov/validators.ts) for the locked regex set.
- **Citation discipline.** Direct quotes ≤ 15 words. One direct quote per source maximum.
- **Locked design tokens.** Use the `--color-*` and `--font-*` CSS variables from `src/app/globals.css`. No new tokens without updating `docs/DESIGN-SYSTEM.md`.

## Forbidden patterns (never ship)

- Purple-to-blue gradients
- Glassmorphism (frosted-glass cards) — use solid elevation steps
- "AI" as a visual element or label
- Sparkles, Bot, Brain, Zap, Wand icons
- Chat-input pretending to be a hero
- Pure white `#FFFFFF` or pure black `#000000`
- Lottie animations (use SVG + GSAP)
- Bounce easing or spring physics where Bezier suffices
- 3D scenes, WebGL, Three.js, R3F (the Manifold experiment was retired)
- The word "Manifold" in user-facing copy
- Naming individual people in UI
- Naming any LLM/model in UI
- Confetti, sound effects, screen shakes

## Commit prefixes

Every commit subject starts with a bracketed agent prefix:

| Prefix | Owner | Examples |
|---|---|---|
| `[glassbox-fe]` | Frontend | UI components, pages, motion, design tokens |
| `[glassbox-data]` | Data | SQL queries, retrieval, embedding, healthcheck |
| `[glassbox-syn]` | Synthesis | Suitability engine, recommendation text |
| `[glassbox-gov]` | Governance | Calibration validators, audit-token schema |
| `[glassbox-ops]` | Ops | Dockerfile, AWS infra, deploy scripts, CI |
| `[pyth-lead]` | Orchestrator | Spec changes, scope cuts, multi-agent commits |

The historical `[pyth-fe]` / `[pyth-data]` etc. prefixes from the pre-rebrand era are preserved in git history and remain valid as internal taxonomy.

## Quality gates

Every PR must pass:

```bash
npm run build       # 0 errors
npx tsc --noEmit    # strict, 0 errors
npm test            # 41/41 (or +N if new tests added)
npm audit --audit-level=high  # 0 high/critical
```

PRs that fail any gate are blocked.

## PR template

```markdown
## What
One sentence on the change.

## Why
What this unlocks for the user / for the demo / for the methodology.

## Tradeoffs
What got cut, what got deferred, what's known-rough.

## Tests
- [ ] All existing tests still pass
- [ ] New tests added for any new public function
- [ ] No console.log in committed code
- [ ] No localStorage / sessionStorage / IndexedDB
- [ ] Calibration sweep passes on any new prose copy

## Screenshots
(If a UI change.)
```

## Adding a forbidden phrase

The calibration regex set in `src/lib/gov/validators.ts` is **locked** — changes require:

1. A documented rationale in `docs/decisions.md` (timestamp, reason, alternatives considered, reversibility, owner).
2. New test case in `src/lib/gov/__tests__/calibration.test.ts` — both a reject example and an accept example proving the regex doesn't false-positive.
3. The 18 anchor test cases (10 reject + 8 accept) MUST stay green.

## Adding a new data source

1. Document the source in `docs/agency2026-data-skill.md` — schema, row count, known landmines.
2. Add a per-source query helper in `src/lib/evaluate/retrieval.ts`.
3. Wire into `searchCorpus` and `retrieveComparables` via `Promise.allSettled` so a failure doesn't poison the others.
4. Add a row to `src/lib/db/healthcheck.ts` so `/api/health` reports the new source.
5. Add a `SourceBadge` palette entry in `src/components/SourceBadge.tsx`.
6. Update README data-sources table.

## License

MIT. Contributions are accepted under the same license. Copyright © 2026 Pythagorithm AI Governance Solutions.
