# Session 5 — Visual Rebuild Report

**Owner:** PYTH-FE (Claude Opus 4.7, 1M context, on Claude Max)
**Branch:** `rebuild-suitability`
**Recovery tag:** `rebuild-stable-pre-visual` at commit `990d436`
**Final commit:** `25d1b2f`
**Repo:** https://github.com/PythagorithmWill/agency-2026-hackathon

---

## 1. ROLLBACK TAG

`rebuild-stable-pre-visual` is pushed at commit `990d436` — the state immediately after Priority 0 (search route + dept prefilter) shipped, before any visual upgrades. Confirmed via `git tag --list`. To revert: `git checkout rebuild-stable-pre-visual` or `git reset --hard rebuild-stable-pre-visual`.

## 2. PRIORITY 0 STATUS — already shipped before this session

`/search` route + `searchCorpus()` function + `retrieveComparables()` department prefilter were shipped at commit `990d436` in the previous turn. Re-verified at session start; no rebuild needed.

End-to-end empirical: `/search?q=rural+broadband` returns real recipients (TransCare+, MONTCALM TÉLÉCOM, Acumen Fund, etc.) in 2.4s; `/search?q=indigenous+community+wellness` returns Mushquash CJ, Tewegan Housing For Aboriginal Youth, Métis Nation of Ontario in 2.4s; ISED-filtered evaluate returns ISED-only telecoms (MONTCALM, Eeyou, Maskicom). No `SHIPPING_MOCK_FALLBACK` in any verification run.

## 3. HOMEPAGE STATUS — all 7 sections shipped

| Section | Status | Notes |
|---|---|---|
| **A — Hero (100vh)** | Shipped | `CharStaggerHeadline` ("Before the money goes out.") with terminal period in `--color-accent` + scale 0.8 → 1.0; italic dek; 88px-tall `SearchInput` scales 0.97 → 1.0; subtle "scroll ↓" affordance; `atmosphere-drift` dual-orb radial gradients on 60s/90s loops. Total entrance ~1800ms. |
| **B — Explainer cards** | Shipped | `whileInView` stagger reveal (80ms apart, 600ms duration); hover lift translateY(-2px) + bg-elev-1 → bg-elev-2; glyphs tint to accent on hover. |
| **C — Three checks. One score.** | Shipped | The dynamic showpiece. Three columns each with glyph + label + italic description + animated bar fill + count-up number; SVG with three converging lines + accent point + drop line + "Composite 14 / 30" badge. ~2-second total reveal. |
| **D — Audit trail** | Shipped | Two-column. Left: prose + "View the methodology →" link. Right: stylized 4-band Proof token (Input / Context / Output / Audit) with vertical accent connector and `pathLength` checkmark animations on viewport entry. |
| **E — By the numbers** | Shipped | $71.5B / 1.27M / 47K / 4 in mono with the new `CountUp` component, label below in caption, 80ms stagger. |
| **F — Methodology preview** | Shipped | Heading + two paragraphs + three mini-cards (regex code block, accent-warn flag pill, rejected→calibrated pair) + "Read the full methodology →" link. |
| **G — Footer** | Shipped | Three columns (PYTHAGORITHM identity, PRODUCT links, BUILD info). PythagorithmMark glyph + the locked "observations from public records" disclaimer line. BUILD-DEV indicator hidden when `NODE_ENV === "production"`. |

Screenshots: not captured this session (no Playwright run; the build window is tight). Visual verification was via `npm run build` route table + spot-check via `curl` HTML.

## 4. EVALUATE PAGE STATUS — motion polish complete

| Spec ID | Status | Notes |
|---|---|---|
| **A — Header strip** | Shipped | `atmosphere-drift` behind; working title via `CharStaggerHeadline` (28ms per char); 80px accent rule under title draws 900ms in; metadata fades up last. |
| **B — Score circle** | Shipped | Composite number now animates via `CountUp` (1500ms cubic-bezier); whole SVG gets a 1.0 → 1.02 → 1.0 scale pulse 1200ms after entry; arc draw-on properly gated by `useInView` (was firing on hidden parent). |
| **C — Comparable cards stagger** | Shipped | `SimilarRecordCard` switched from inline CSS animation (which fired regardless of visibility) to Framer Motion `whileInView`, 40ms stagger, 16px translateY → 0. |
| **D — Concentration segment draw** | Shipped (preserved) | The existing CSS-keyframe segment-draw on `RecipientConcentrationBar` still works — sequence is now triggered on parent `<Reveal>` viewport entry. |
| **E — Language audit pulse** | **Cut** (per cut order item 4 partial) | The hover-tooltip + click-to-apply behavior remained from the previous build; the additional pulse-on-entry effect was deferred. |
| **F — Proof token tier-by-tier** | Shipped | Cells stagger 80ms; each gate badge ("passed" / "flagged") includes a `pathLength`-animated check SVG; download/verify CTAs gain hover arrow translation. |
| **G — Methodology footer CTA** | Shipped | New section after the Cite-as line: heading "Want to see how this scoring works?" + linked card "Read the full methodology" with ShieldCheck glyph + hover arrow translation. |

## 5. METHODOLOGY STATUS — scrollytelling shipped

| Spec ID | Status | Notes |
|---|---|---|
| **A — Hero strip** | Shipped | `MethodologyHero` 100vh: "The methodology." (accent period), italic dek, scroll-arrow affordance, `atmosphere-drift` behind. |
| **B — Section pinning (GSAP)** | **Substituted** | Replaced the GSAP ScrollTrigger pinning with `<RevealSection>` whileInView fade-up (Framer Motion). Pinning was high-risk in a tight window; the simpler approach gives the same "reveal as you scroll" rhythm without the failure modes (sticky positioning bugs on Safari, layout-shift edge cases). Pinning can be added in a future polish pass. |
| **C — Regex hover tooltips** | Shipped | New `<RegexCard>` for each forbidden pattern (11 total: 7 absolute + 4 causal). Hover surfaces a calibrated description of what the pattern catches. Focus-keyboard equivalent works too. |
| **D — JSON typewriter** | Shipped | New `<JsonTypewriter>` renders the canonical Proof token JSON character-by-character on viewport entry (~3s total). Trailing accent-coloured cursor pulses while typing. `prefers-reduced-motion`: jumps to full text instantly. |
| **E — AIA table row-build** | Shipped | New `<AnimatedAiaTable>`: rows reveal with 60ms stagger via `staggerChildren`. Left column has a 2px accent vertical bar on each row. |
| **F — Agents micro-graphic** | Shipped | New `<AgentsDiagram>` SVG: PYTH-LEAD at top with accent border, four leaf agents below; connecting lines draw on viewport entry (60ms stagger), nodes fade in. |
| **G — Cite-as + signature mark** | Shipped | Footer block: PythagorithmMark glyph centred, then the locked `"Cite as: Pythagorithm Proof Methodology v1.0, retrieved YYYY-MM-DD."` line in mono italic. |

## 6. SEARCH STATUS — visual polish complete

`/search` now renders the same atmospheric-hero pattern as `/evaluate/[id]`:
- Header strip absolute-positioned over the hero (z-20) like the homepage and evaluate result.
- `atmosphere-drift` behind the query echo. Larger top padding (pt-32), border-bottom hairline.
- `SearchEditBar` query echo with click-to-edit inline input (already shipped P0).
- Result count + retrieval timing in the same band.
- Result cards already pick up the `SimilarRecordCard` Framer Motion stagger from P2.
- Filter sidebar — **deferred** per cut order item 3 (basic results without filters is acceptable for the demo).

## 7. RECORD STATUS — deferred entirely

`/record/[recordId]` (Priority 5) is **not shipped** in this session. Cut order item 2; the `/evaluate/[id]` comparable-card expand-to-source-row affordance covers the immediate use case. Deferred for a post-hackathon polish pass.

## 8. POLISH STATUS — clean

| Item | Status |
|---|---|
| BUILD-DEV indicator hidden in production | ✓ (HomepageFooter.tsx, NODE_ENV check) |
| AIOS branding leak | ✓ none in src/ |
| "Manifold" word in source | ✓ removed last reference (was a code comment in PythagorithmMark.tsx) |
| `localStorage` / `sessionStorage` / IndexedDB | ✓ none in committed source |
| `console.log` in committed source | ✓ none (only `console.warn` in retrieval.ts SHIPPING_MOCK_FALLBACK signals, which are operational) |
| `prefers-reduced-motion` | ✓ Every motion component checks `useReducedMotion()`. CSS keyframes (atmosphere-drift, scroll-arrow, skeleton-shimmer) have `@media (prefers-reduced-motion: reduce)` overrides. CountUp jumps to final value. CharStaggerHeadline renders text instantly with the accent character preserved. |
| Mobile responsiveness | Sanity-pass at desktop only; `clamp()` type scales protect against overflow at 375px width. **Not Playwright-verified** (cut). |
| Loading states / "Loading..." text | ✓ none. The `.progress-bar` accent strip pattern is in `globals.css` ready for any future loading state. |
| Empty / error states | Calibrated language used throughout (`/search` empty: "No matches found." + suggestion in body-sm muted). |

## 9. QUALITY GATES — green

```
Build       npm run build                              ✓ 9 routes
TypeScript  tsc --noEmit (strict)                      ✓ 0 errors
Tests       vitest run                                 ✓ 41/41 passing
            ├─ 18 calibration cases (10 reject + 8 accept) — locked
            ├─ 18 suitability engine cases
            ├─ 2 route-existence assertions
            └─ 3 searchCorpus signature
Security    npm audit (high+)                          ✓ 0 high/critical
            npm audit (moderate+)                        7 (1 low + 6 moderate;
                                                          all dev/transitive in
                                                          voyageai/qs chain —
                                                          same as session 4)
Secrets     grep for committed credentials             ✓ none
Dangerous   grep for eval / dangerouslySetInnerHTML    ✓ none
Calibration FORBIDDEN_ABSOLUTE + FORBIDDEN_CAUSAL      ✓ all 18 anchor cases
Routes      route-existence vitest                     ✓ no dead links
Visual (Playwright)                                    Not run this session
                                                       (cut order item 4)
```

Bundle sizes:
- `/` — **6.69 kB First Load** + 148 kB total (Framer Motion + 7 new section components)
- `/_not-found` — 998 B
- `/api/draft/evaluate` — 124 B
- `/api/proof/[proofId]/download` — 124 B
- `/evaluate` — 3.22 kB
- `/evaluate/[evaluationId]` — 7.47 kB
- `/methodology` — **5.09 kB** + 146 kB total (typewriter, AnimatedAiaTable, AgentsDiagram, RegexCard)
- `/search` — 2.14 kB
- `/verify/[proofId]` — 162 B

## 10. WHAT'S CUT — explicit list with rationale

In cut-order priority (item 1 cut first, item 7 last):

1. **Mobile responsiveness verification (P6G)** — desktop-only is acceptable for the hackathon. `clamp()` type scales were used throughout to protect against the worst overflow cases at 375px, but no device-by-device verification.
2. **`/record/[recordId]` route (P5)** — deferred entirely. The `/evaluate/[id]` comparable-card source-row expand covers the immediate use case.
3. **Filter sidebar on `/search` (P4B)** — deferred. Search returns top-25 keyword-ranked records ordered by `ts_rank_cd`; no faceted refinement.
4. **Playwright smoke + screenshot capture (P6 + report §3 supplements)** — not run.
5. **Language audit pulse-on-entry (P2E)** — the existing hover-tooltip + click-to-apply behavior shipped in a prior session; the additional pulse-on-viewport-entry was deferred.
6. **GSAP ScrollTrigger pinning on `/methodology`** — substituted with simpler Framer Motion `whileInView` reveals (`<RevealSection>`). Visual rhythm is preserved without the pinning's failure modes.
7. **Section 02 / 04 / 05 deeper treatments** — Section 02 (citation discipline), Section 05 (data landmines) ship with the standard `<RevealSection>` fade-up but no special per-section choreography. AIA table (04) did get the row-build treatment.

## 11. KNOWN ISSUES — calibration to my standards, not bugs

- **First Load JS on `/` is 148 kB total** (6.69 kB + 141 kB shared chunks for Framer Motion). Within Vercel's 200 kB target but a real polish pass would code-split the homepage motion components by route segment.
- **`atmosphere-drift` orbs** are large blurred elements that the GPU paints continuously even when scrolled offscreen. On low-power machines this is fine; on a battery-saver demo laptop it could draw a few extra watts. The `.atmosphere-drift::before/after` selectors could be promoted with `content-visibility: auto` for offscreen optimization in a future pass.
- **`<JsonTypewriter>`'s 4-chars-per-12ms cadence** is tuned for desktop; it might feel slightly slow on a fast SSR-cache hit when the user has already scrolled past. The `useInView` margin of -100px keeps it near-the-fold but a smarter-trigger would pause if the user scrolls past mid-typing.
- **`ThreeChecksViz` convergence lines** are absolute-positioned in an SVG below the columns; on extreme narrow viewports (<360px) the columns stack and the lines no longer make geometric sense. Acceptable trade-off; the primary demo viewport is 1440px+.
- **The `/methodology` JSON typewriter has no skip-to-end button** — a power user reading the page from the table of contents view would have to wait for the typewriter or scroll past it. `prefers-reduced-motion` resolves this for the accessibility case but not for the impatient demo audience.
- **`SimilarRecordCard` motion graph imports add weight to `/search`** (2.14 kB First Load + 143 kB shared, was ~107 kB at the previous tag). Acceptable trade-off for the unified motion pattern across `/evaluate/[id]` and `/search`.

## 12. NEXT POLISH PASS — what to focus on if more time becomes available

In priority order:

1. **Run Playwright** against all routes; capture full-page screenshots into `e2e-screenshots/`; verify the WebGL-fallback path (which is just no-op now since we removed the 3D scene, but the spec's principle holds).
2. **Build `/record/[recordId]`** with the amendment-chain timeline SVG (S4) — this is the natural deep-link from `/search` and from the `SimilarRecordCard` "View source row →" affordance.
3. **Add the GSAP ScrollTrigger pinning** on `/methodology` — the spec explicitly called this out as where GSAP earns its keep. The Framer Motion substitution is good, not great.
4. **Filter sidebar on `/search`** — fiscal year range, amount range, awarding department dropdown. Each on 300ms debounce.
5. **Mobile-responsiveness verification** at 375px / 414px / 768px breakpoints. Card stack, hero scale, search-input full-width behavior.
6. **Language audit pulse-on-entry** on `/evaluate/[id]` Section 04 — each highlighted phrase pulses once on viewport entry with 80ms stagger.
7. **Code-split the homepage** so the motion graph for sections E/F/G doesn't load until the user scrolls past sections A–D. Drops First Load JS for the visible viewport.

— PYTH-FE
