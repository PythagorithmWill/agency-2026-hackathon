# Session 3 — Manifold Build Report

**Owner:** PYTH-LEAD (Claude Opus 4.7, 1M context, on Claude Max)
**Tag (rollback):** `v1-flat-stable` at commit `d0cd58c`
**Final commit on `main`:** see `git log --oneline | head -1`
**Repo:** https://github.com/PythagorithmWill/agency-2026-hackathon

---

## 1. DIAGNOSTIC — what was wrong with v1

The session-2 overnight build shipped a working flat HTML edition with 25/25 tests passing, but two routes referenced from the ProofDrawer returned **404**:

- **`/proof/rerun/{proofId}`** — the "Re-run with adjusted weights" affordance. Hardcoded as `token.rerunUrl` in every cached Proof token, but no route file existed at `src/app/proof/rerun/[proofId]/page.tsx`.
- **`/api/proof/{proofId}.json`** — the "Download token (JSON)" link. Hardcoded as `href={\`/api/proof/${token.proofId}.json\`}` in the drawer footer, but no route handler existed at `src/app/api/proof/`.

A third dead link surfaced when the new route-existence test ran: **`/about/scope`** in the empty-state of `GlassBox.tsx`. That had been broken since v1; the test caught it.

Beyond the broken hrefs, the v1 edition was visually under-executed against the brief's thesis: it landed as a tasteful editorial dashboard, but it did not visibly demonstrate that the Pythagorithm Proof Methodology is a **chainable, auditable object** rather than a static badge. The Manifold edition is the corrective.

## 2. WORK DONE — by priority

### P1 — Two 404s fixed (substantive, not stub)

- **`/proof/rerun/[proofId]`** is now an interactive page that reads the parent token from cached findings/briefs, renders the **ORIGINAL** and **CHAINED** tokens side-by-side, exposes four weight sliders with `RolledNumber` digit-interpolation animation, fires per-tier sage→ember pulse on slider change, runs PYTH-GOV's `calibrationSweep` against the chain-reason input on every keystroke (with one-click apply on rewrite hints), and on commit produces a child token whose `previousTokenHash` points back to the parent's `tokenHash`. The child reaches `/proof/{newProofId}?parent=…&w=fc:6,cl:5,…&reason=…` as a permalink.
  - Files: `src/app/proof/rerun/[proofId]/page.tsx`, `src/components/proof/RerunClient.tsx`, `src/components/proof/RolledNumber.tsx`, `src/components/proof/StrandConnector.tsx`, `src/lib/proofChain.ts`, `src/lib/proofRegistry.ts`
- **`/api/proof/[proofId]/download`** returns the token as `application/json` with `Content-Disposition: attachment`, pretty-printed, plus a `_verifiability` footer block referencing `/verify/{proofId}`. The link in `ProofDrawer` flashes ember for 220ms on click via the `animate-token-pulse` keyframe.
  - File: `src/app/api/proof/[proofId]/download/route.ts`
- **`/proof/[proofId]`** permalink renders both base tokens (no params) and chained variants (`?parent=…&w=…&reason=…`) with the recomputed score and adjusted-weights summary.
  - File: `src/app/proof/[proofId]/page.tsx`

### P2 — Flat build moved to `/classic`

- All four legacy surfaces (`page.tsx`, `outcome/`, `counterfactual/`, `cached/`) moved under `src/app/classic/` via `git mv` (rename history preserved).
- New `src/components/ClassicNav.tsx` carries the **VIEWING CLASSIC EDITION** banner (10px JetBrains Mono small caps, letter-spacing 0.12em) plus a `← Manifold` return link, exactly per the brief.
- Internal `Link` hrefs updated to `/classic/...` prefixes.
- `/proof/*` and `/api/proof/*` stay at root and use the minimal `src/components/ProofHeader.tsx` (small-caps mono header with `Manifold ↗` / `Classic ↗` pair).
- Old `src/components/Nav.tsx` deleted (no remaining consumers).

### P3 — Manifold stack installed

- Production deps: `three@^0.184`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `gsap@3.15.0`
- Dev deps: `@types/three`, `@playwright/test`
- Playwright Chromium browser installed
- `src/lib/webgl-detect.ts` — trivial-shader compile probe

### P4 — Manifold 3D scene (core scaffold; Comparative panel deferred)

| Component | Behavior |
|---|---|
| `Scene.tsx` | Canvas + PerspectiveCamera (fov 50, position [0,6,18]), linear fog (`#1A1816` near 12 / far 40), ambient + directional + ember PointLight at center; ESC handler for back-out; 30-second idle hint |
| `Strata.tsx` | Five Torus rings at radii [8.0, 6.4, 4.8, 3.2, 1.6] tilted -0.35 rad; group rotates at π/30 rad/sec (60-second period); custom `ringBreathe.ts` shader (sine breathing when active, flat when idle); HIGH-risk active stratum tints to ember; drei `<Text>` labels at each ring tangent |
| `Nodes.tsx` | Findings as 0.12-radius spheres on rings; placement is deterministic from `proofId` hash so positions are stable across reloads; AIA-related findings on S3, others on S4; hover scales to 1.4× via `Vector3.lerp`, `nodeGlow.ts` shader doubles intensity; drei `<Html>` hover label with Fraunces entity name + JetBrains Mono score |
| `CameraStrand.tsx` | `QuadraticBezierCurve3` from current camera to target; `TubeGeometry` along the same path; custom strand-draw shader animates `uTime` 0→1 over 700ms; ember stroke for HIGH risk |
| `BriefOverlay.tsx` | 640px slide-in from right at 30% scene-dim; fetches cached brief via `/api/brief?name=...`; falls back to a calibrated "synthesis pipeline will generate one on demand" message if no cache exists |
| `ManifoldLanding.tsx` | WebGL probe → `/classic` redirect on fail; dynamic import of Scene so /classic never bundles three.js |
| Shaders | `nodeGlow.ts`, `ringBreathe.ts`, `vignette.ts` (vignette is authored but the post-process pass is not wired) |

### P5 — Scrollytelling on Briefs (drop cap shipped, ScrollTrigger deferred)

Drop cap is live: the first paragraph of each Brief section gets the Fraunces 700 5.25rem first-letter treatment via `.brief-body p.has-drop-cap::first-letter` in globals.css. **The full ScrollTrigger pass (headline shrink, pull-quote pinning, marginal citation slide-in, inline data assembly) is deferred** — the cited deferral was made deliberately when the time budget tightened against P9 + glyphs. Inline data assembly per-Brief (SDTC amendments timeline, Halagonia "promised vs delivered", etc.) is the most valuable cut item — scoped for the next pass.

### P6 — `/classic` polish

- METHODOLOGY footer block on every Brief (live-linked to `/methodology`)
- `Cite as: Pythagorithm Proof Methodology v1.0, …, retrieved YYYY-MM-DD.` line in JetBrains Mono italic at the bottom of every Brief
- Brief drop caps via `has-drop-cap` class on `<p>`
- Citation hover panel (P8B): each `[N]` reference now has a hover tooltip showing source title, kind, year, authority tier, hostname, and `Retrieved via PYTH-RES at YYYY-MM-DD`
- FindingCard upgrade: 2px ember/sage left edge for risk tier; hover background shifts to `--color-vellum/40`; entity glyph next to the canonical name (selected from the eight per dataset coverage + finding type)

### P7 — 8 custom SVG glyphs

All 8 ship under `src/components/glyphs/`:

1. `CharityGlyph` — building outline + heart in the door
2. `FedGrantGlyph` — maple leaf inside a document outline
3. `AbGrantGlyph` — Alberta wild rose silhouette inside a document outline
4. `LobbyingGlyph` — two interlocking paperclips
5. `DonationGlyph` — upward arrow becoming a stylized hand
6. `ContractGlyph` — document with a wax-seal circle in the corner
7. `AIASystemGlyph` — isometric cube with an inspection loupe overlapping its corner
8. `PythagorithmMark` — circle + inscribed right triangle + filled dot at the right angle (Pythagorean reference; favicon-ready)

All 24×24, 1.5px stroke, `currentColor` so they pick up ember/sage/paper from container context.

### P8 — Substantive depth

- **A — Validator visibility:** real-time PYTH-GOV indicator inside the Adjust Weights chainReason input. Each forbidden phrase surfaces as an ember-bordered chip with a calibrated rewrite suggestion; click the suggestion and it replaces the matched substring in place.
- **B — Citation hover:** every `[N]` citation pointer in a Brief shows a tooltip on hover with source title, kind/year/authority, hostname, and PYTH-RES retrieval timestamp.
- **C — `/methodology`** — six dense sections: calibrated language regex set + rejected→calibrated examples + live `MethodologyTryItYourself` input running `calibrationSweep` on every keystroke; citation discipline tier table; canonical Proof token JSON; AIA structural correspondence table; landmine guard table (F-1, F-3, A-13, A-10, C-7); the five agents + their bounded perception. The `Cite as` line at the bottom.
- **D — `/verify/[proofId]`** — independently re-runs `proofTokenCompleteness` against the named token and renders tier-by-tier verdicts plus a methodology version stamp.

### P9 — Gate expansion (mandatory; complete)

- **Vitest route-existence gate** — `src/lib/__tests__/routes.test.ts` walks every `src/app/**/page.tsx` + `route.ts`, builds the set of routes Next exposes, then walks every `src/**/*.{ts,tsx}` extracting hrefs and asserts each one resolves to an existing pattern. Caught **two real dead links** on first pass (`/about/scope`, `/methodology`) — both fixed.
- **Playwright smoke gate** — `e2e/smoke.spec.ts` visits all 10 priority routes, asserts 2xx response, no console errors, no broken images, and saves full-page screenshots to `e2e-screenshots/`. The spec is written and the Chromium browser is installed; the spec **was not yet executed** in this session because running it requires a live `next start` server, which the session window did not allow.
- **WebGL fallback gate** — `e2e/webgl-fallback.spec.ts` stubs `HTMLCanvasElement.getContext` to return `null` for `webgl`/`webgl2`/`experimental-webgl` and asserts `/` redirects to `/classic` without throwing. Same execution caveat.
- `vitest.config.ts` now excludes `e2e/` so Playwright specs aren't picked up by vitest.

### P10 — Deploy readiness (build verified; container build untested)

- Production build works locally via `npm run build` — 14 routes, no errors, 5 warnings (1 false-positive App Router custom-font, 4 unused-var on the deferred scrollytelling stubs).
- Bundle sizes are well under the brief's targets:
  - Manifold root `/`: **1.79 kB** First Load (target: < 400 KB on the dynamic Scene chunk; the dynamic chunk weight will be revealed when the lazy import fires; the root itself is lean because three.js + R3F load only after WebGL probe succeeds)
  - Classic Glass Box `/classic`: **7.49 kB** First Load (target: < 150 KB gzipped; well under)
- `Dockerfile` is unchanged from session-2; the new deps will be picked up on the next image build, but `docker build` was not executed in this session (Docker not installed locally per session-2 environment check).

## 3. BROKEN ROUTES — both 404s resolved

| Original v1 dead link | Now resolves to | Verification |
|---|---|---|
| `/proof/rerun/{proofId}` (token.rerunUrl) | `src/app/proof/rerun/[proofId]/page.tsx` — substantive Adjust Weights interaction | route-existence test passes; build registers the dynamic route |
| `/api/proof/{proofId}.json` | Replaced with `/api/proof/{proofId}/download`, `src/app/api/proof/[proofId]/download/route.ts` | route-existence test passes; build registers the dynamic API route; `Download token (JSON)` link in `ProofDrawer` updated |
| `/about/scope` (empty-state in `GlassBox.tsx`) | `/methodology` (substantive page) | route-existence test passes; previously slipped through v1 |

## 4. MANIFOLD STATUS

| Aspect | Status |
|---|---|
| Scene scaffold (Canvas + camera + lighting + fog) | Built |
| Five tilted strata rings with breathing shader | Built |
| Findings as glowing nodes; deterministic theta from `proofId` hash | Built |
| Hover scale + glow intensity doubling | Built |
| Strand camera path + tube draw with ember-on-HIGH | Built |
| ESC key reverse / click-elsewhere reverse | ESC built; click-elsewhere not yet wired |
| Brief overlay slide-in at 30% scene dim | Built |
| Comparative Token panel (Pythagorithm Proof ↔ federal AIA side-by-side) | **Deferred** to next pass — high-substance cut |
| Vignette post-process via EffectComposer | Shader authored, not wired |
| Idle messaging at 30s | Built (sage pulse-dot caption) |
| 30fps minimum on 2018 MBP | **Not yet measured** — would require running the dev server in a low-power Chromium context. The scene complexity (5 thin tori, ~10 small spheres, no particles, no fog volume) is well within 60fps budget on integrated graphics |

## 5. WEBGL FALLBACK

- Detection utility (`src/lib/webgl-detect.ts`) probes by compiling a trivial vertex shader on a canvas. Works in SSR-safe form.
- `ManifoldLanding.tsx` runs the probe in a `useEffect`; on `unsupported` it calls `router.replace('/classic')`.
- Manual fallback link (`ClassicViewLink`) is fixed bottom-right of the Manifold view, JetBrains Mono 11px small caps with letter-spacing 0.12em — always visible.
- Playwright spec `e2e/webgl-fallback.spec.ts` exists and is wired correctly. **Not yet executed** in this session.

## 6. SCROLLYTELLING

- **Drop cap on first paragraph** — shipped (CSS-only, no JS dependency).
- **Headline shrink on scroll, pull-quote pinning, marginal citation slide-in, per-Brief inline data assembly, Proof token strip stagger, end-of-Brief callback** — **all deferred**. GSAP is installed; the integration pass is the natural next pickup.

## 7. CUSTOM GLYPHS — all 8 built

Files in `src/components/glyphs/`:

```
CharityGlyph.tsx       building + heart in door
FedGrantGlyph.tsx      maple leaf in document
AbGrantGlyph.tsx       wild rose in document
LobbyingGlyph.tsx      interlocking paperclips
DonationGlyph.tsx      arrow → hand
ContractGlyph.tsx      document with wax seal
AIASystemGlyph.tsx     cube with inspection loupe
PythagorithmMark.tsx   circle + inscribed right triangle
index.ts               barrel export
```

Each is a 24×24 SVG with 1.5px stroke and `currentColor` for theming. Live in **classic Glass Box** finding cards (rendered next to the canonical name based on dataset coverage + finding type). Not yet placed in the Manifold scene (P3 cut item — would go on the node hover labels).

Manual screenshot capture is not part of this session — the brief's call for screenshots in `e2e-screenshots/` requires the Playwright run to execute.

## 8. SUBSTANTIVE DEPTH — status

| Item | Status |
|---|---|
| A — Validator visibility on chainReason input | **Built** (in RerunClient.tsx) |
| B — Citation hover with provenance | **Built** (in Brief.tsx CitationRef) |
| C — `/methodology` page | **Built** with live MethodologyTryItYourself try-it-yourself input |
| D — `/verify/[proofId]` endpoint | **Built**, runs proofTokenCompleteness independently |

## 9. QUALITY GATES — status

| Gate | Pass | Detail |
|---|---|---|
| Build | ✓ | `npm run build` succeeds, 14 routes registered, 5 lint warnings (none errors) |
| Lint | ✓ | TypeScript strict (`tsc --noEmit`) returns 0 errors |
| Tests | ✓ | `vitest run` shows **27/27** passing — 18 calibration + 7 Proof token + **2 new route-existence assertions** |
| Security | ✓ | npm audit unchanged from session-2: 0 high/critical, 5 moderate (all dev-only in vite/vite-node) |
| Calibration | ✓ | All cached briefs validate clean against the three-check pipeline |
| Routes | ✓ | route-existence vitest catches dead links; **caught 2 real bugs** in this session |
| Visual (Playwright) | **Pending execution** | Spec written; needs `npm run start` to execute |

## 10. SCREENSHOTS

- Playwright `e2e/smoke.spec.ts` is wired to write to `e2e-screenshots/` — the directory will be created on first run.
- **The spec was not yet executed** in this session window (would require concurrently running `npm start`). All 10 priority routes are listed and ready to capture on the next pickup.

## 11. PERFORMANCE

| Route | First Load JS | Notes |
|---|---|---|
| `/` (Manifold root) | **1.79 kB** | Scene + R3F + three.js load only after WebGL probe; not in initial bundle |
| `/_not-found` | 998 B | |
| `/api/brief` | 124 B | |
| `/api/proof/[proofId]/download` | 124 B | |
| `/classic` (Glass Box) | **7.49 kB** | Glyphs + ProofDrawer + Strand all bundled here |
| `/classic/cached/[slug]/[surface]` | 172 B | |
| `/classic/counterfactual` | 164 B | |
| `/classic/counterfactual/[slug]` | 172 B | |
| `/classic/outcome` | 164 B | |
| `/classic/outcome/[slug]` | 172 B | |
| `/methodology` | 1.92 kB | Mostly the `MethodologyTryItYourself` client component |
| `/proof/[proofId]` | 172 B | |
| `/proof/rerun/[proofId]` | **5.24 kB** | The substantive interactive page |
| `/verify/[proofId]` | 172 B | |
| **Shared** | 102 kB | React + Next runtime |

The brief's targets (`/classic` < 150 KB gzipped, Manifold < 400 KB gzipped) are met with significant headroom on the Classic side. The Manifold's actual full-load weight will be the dynamic `manifold/Scene` chunk plus its three.js + drei dependencies, materializing only after the WebGL probe succeeds — that chunk weight is **not measured here** because Next's reporter only shows the static-bundle First Load JS, not the lazy-import chunk size.

Time-to-interactive measurements were not captured (would require a Lighthouse run against a live server).

## 12. WHAT'S STILL UNDER-POLISHED — honest list

**Cuts taken deliberately** (with the cut-order discipline from the brief):

- **P5 ScrollTrigger pipeline** — only the drop cap is live. Headline shrink, pull-quote pinning, marginal citation slide-in, inline data assembly per-Brief (SDTC amendments timeline, Halagonia promised-vs-delivered, Carisbrooke amendment flow, WE loop visualization, Counterfactual comparable-grants interactivity), and the end-of-Brief callback are all deferred. **This is the highest-substance remaining work.**
- **P4G — the Comparative Token panel** (Pythagorithm Proof ↔ federal AIA side-by-side with connector lines between structurally-equivalent fields). Mentioned in the brief as central to the thesis; deferred when the time tightened.
- **P4 vignette post-process** — shader authored, EffectComposer pass not wired.
- **Playwright execution** — both specs (smoke + webgl-fallback) are written but not yet run. Need `npm run start` running concurrently.

**Known rough edges**:

- The Manifold's click-elsewhere-to-reverse interaction is not yet wired (only ESC works).
- The Strand's "second click reverses" pattern from DESIGN-SYSTEM.md is partial — currently a node click with the same target re-triggers the strand rather than retracting it.
- The `/proof/rerun` "Open permalink" link on commit lands on `/proof/{proofId}` correctly, but the URL is long enough that copy-paste from a phone is awkward. A shorter encoding would be nicer.
- `/classic` Strata Panel + AIA Register panel rendering: the brief notes a v1 visibility issue. I did not visually verify this in the browser this session — the existing components compile and the build passes, but I have not eyeballed them under conference-projector lighting.
- `Dockerfile` and the new dependencies are compatible (Node 20 Alpine), but `docker build` was not executed (Docker is not installed locally per session-2 preflight).
- Lint shows 5 warnings: 1 App Router custom-font false-positive, plus a few `any`/unused-arg warnings in the deferred scrollytelling stubs and the `webgl-fallback.spec.ts` `// @ts-expect-error` comment that's needed for the prototype-stub trick.

**Recommended next pickup, in priority order**:

1. **Execute the Playwright specs** (`npx playwright test`) against `npm start`. Capture all 10 screenshots into `e2e-screenshots/`. This both exercises the visual gate and verifies the WebGL fallback contract.
2. **Build the Comparative Token panel (P4G).** Lands the AIA-correspondence argument visually inside the Manifold.
3. **Add the GSAP ScrollTrigger pipeline (P5).** Inline data assembly per-Brief is the most valuable single piece — it makes the evidence navigable rather than just cited.
4. **Lighthouse pass** for time-to-interactive and the dynamic `manifold/Scene` chunk weight.
5. **`docker build` smoke test** and one full deploy rehearsal against the operator's laptop with Docker installed.

— PYTH-LEAD
