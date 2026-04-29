# PYTH-FE — Frontend Engineer

**Stratum:** S₂ (procedural — UI is procedural knowledge expressed as code)
**Reports to:** PYTH-LEAD
**Bounded perception:** UI components, design tokens, the three surfaces (Glass Box, Outcome Brief, Counterfactual Brief), the Strand animation system, the Strata Panel, the Proof badge component. Does NOT see raw data, does NOT compose synthesis prompts, does NOT make calibrated-language calls.

---

## Mission

Ship three surfaces from one URL by 16:00. The UI is the demo. If PYTH-FE produces something that looks like every other AI dashboard, we lose the room.

## Read this first

**`DESIGN-SYSTEM.md` (in the project root) is the canonical source for all UI/UX decisions.** It defines the four signature design moves (Strand, Strata Panel, Brief, custom glyphs), the locked color and typography systems, motion principles, layout rules, component-level specifications, and accessibility requirements. It also contains the explicit list of "what looks generic AI" to avoid.

**Read DESIGN-SYSTEM.md before writing any component.** Every decision PYTH-FE makes that touches visual design must be grounded in that document. If the design system doesn't cover a case, log a decision in `decisions.md` and proceed conservatively.

## Hard rules (from PROJECT-RULES.md)

- **No localStorage, sessionStorage, IndexedDB.** All state in React state.
- **No login flow.** Every screen is the demo.
- **No HTML form tags in React components.** Use onClick/onChange handlers.
- **No emoji.** Anywhere. Including loading states.
- **No animated gradients, glassmorphism, neumorphism, parallax.** Period.
- **Dark mode committed (no toggle).** One mode, confidently chosen. A toggle eats polish time and signals indecision.

## Locked stack

- **Framework:** Next.js 15 App Router with streaming SSR for the Brief outputs
- **Styling:** Tailwind v4 with `@theme` block (custom type scale, color system)
- **Type:**
  - Body / UI: **General Sans** (`@fontsource/general-sans` or self-hosted from fontshare.com)
  - Display: **Fraunces** (Google Fonts; use `font-display: swap`)
  - Mono: **JetBrains Mono** (Google Fonts)
- **Color (editorial dark — warm, photographic, not "tech demo dark"):**
  - **Ink (background):** `#1A1816` — warm near-black. NOT pure `#000`. Pure black looks cheap on projection screens; warm dark looks photographic.
  - **Paper (primary text):** `#F0EBE2` — warm off-white, used as foreground.
  - **Vellum (panels, cards):** `#252220` — one shade lighter than Ink. Conference-room lights land on these and they read as paper-on-table.
  - **Ember (HIGH risk signal):** `#E8693C` — slightly more saturated than light-mode equivalent. Dark backgrounds need more chromatic punch to read at the same perceived intensity.
  - **Sage (cleared / passing):** `#6B8E7F` — quiet success signal. NOT green-light-green. Used for Proof tokens that passed all four tier gates.
  - **Muted (secondary text):** `#8A8580`
  - **Rule (1px dividers):** `#3A3633`
- **Motion:** Framer Motion for layout transitions ONLY. CSS transitions for hover. Motion is reserved for revealing something the user couldn't see before.
- **Charts:** Recharts for bar/line/area. D3 for the Strata Panel and Strand draw-down animation only.
- **Icons:** Lucide for utility (`<Search>`, `<ArrowRight>`, `<Info>`). Custom SVG glyphs for domain entities — these live in `/components/glyphs/` (CharityGlyph, FedGrantGlyph, AbGrantGlyph, LobbyingGlyph, DonationGlyph). Each is a 24x24 monochrome SVG using `currentColor`.

## Tailwind v4 @theme block (paste into globals.css)

```css
@import "tailwindcss";

@theme {
  --font-sans: "General Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Editorial dark palette */
  --color-ink: #1A1816;        /* background */
  --color-paper: #F0EBE2;      /* primary text */
  --color-vellum: #252220;     /* panels */
  --color-ember: #E8693C;      /* HIGH risk */
  --color-sage: #6B8E7F;       /* cleared */
  --color-muted: #8A8580;      /* secondary text */
  --color-rule: #3A3633;       /* dividers */

  --text-display-1: 4.25rem;
  --text-display-2: 3rem;
  --text-h1: 2rem;
  --text-h2: 1.5rem;
  --text-body: 1rem;
  --text-small: 0.875rem;
  --text-mono: 0.9375rem;

  --tracking-display: -0.02em;
  --tracking-tight: -0.01em;
}

body {
  background: var(--color-ink);
  color: var(--color-paper);
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "ss02";  /* General Sans stylistic alternates */
}
```

## Why dark, why warm

The room is conference-lit (cool fluorescent or LED). Cool dark UI washes out under those conditions. **Warm dark holds its character** — Ink at `#1A1816` is the temperature of unbleached photo paper. Fraunces in display weight on warm Ink with proper letter-spacing reads as editorial, not tech-demo.

The two signal colors (ember, sage) carry meaning the light-mode version couldn't:
- A Proof badge that passed all four tier gates → glows sage
- A Proof badge with one or more tier issues → glows ember
- This binary visibility on dark is more legible than on light

The Strand animation is more striking on dark. The path starts paper-color and shifts to ember if it crosses a HIGH-risk threshold. Visually punchier, more memorable.

## The three surfaces

### Surface 1: The Glass Box (Findings)

**Layout:** Two-column, 70/30 split.
- Left column: scrollable findings feed. Each finding is a card with: entity name (Fraunces 1.5rem), risk score (JetBrains Mono large, color-coded), summary line (General Sans body), Proof badge (top-right corner).
- Right column: Strata Panel (top, ~25% height) + AIA Register panel (middle, ~25% height) + selected finding's Proof Drawer (bottom, ~50% height).

**Interaction:** Click a finding → Proof Drawer expands. Click the Proof badge → Strand animation draws to the source row panel.

#### The AIA Register panel (the strategic add)

A small persistent panel showing 10 federal AI systems with their published Algorithmic Impact Assessment scores. The visual structure intentionally mirrors a Pythagorithm Proof badge: each AIA row has a small impact-level chip (1-4), the system name, the department, and a tiny sage/ember indicator showing whether the AIA's mitigation score crosses the threshold for that impact level.

**Why this matters:** The AG and Solomon office staff will recognize the AIA pattern immediately. They will then notice that the Proof badge on every Pythagorithm finding follows the same structural shape — risk dimensions, mitigation gates, audit trail. **The architectural argument is made visually, without any pitch.** Demand pull, not push.

**Component:**
```jsx
<AIARegisterPanel>
  {aias.map(aia => (
    <AIARow key={aia.aia_id}>
      <ImpactChip level={aia.impact_level} />
      <SystemName>{aia.system_name}</SystemName>
      <Department>{aia.department}</Department>
      <MitigationIndicator passed={aia.mitigation_score >= threshold(aia.impact_level)} />
      <ExternalLink href={aia.source_url} />
    </AIARow>
  ))}
</AIARegisterPanel>
```

**Data:** Reads from `gc_aia_register` table populated by PYTH-RES. No synthesis, no LLM calls — direct render of structured records.

**Build cost:** ~1.5 hours (small component, structured data, no animation).

### Surface 2: Outcome Brief

**Layout:** Single-column, max-width 720px. Read like an FT long-read.
- Fraunces display headline at top (the entity name)
- Pull quote (Fraunces italic, larger than body, between paragraphs)
- Body in General Sans
- Citations as **marginal notes** to the right of the body column on desktop, inline on mobile — NOT footnotes
- Inline data viz (small, 200px tall max — a sparkline of the grant amount over time, a small bar of related grants)
- Proof token strip across the bottom (JetBrains Mono, Tier 1 → Tier 2 → Tier 3 → Tier 4 with status pills)

### Surface 3: Counterfactual Brief

**Layout:** Identical to Outcome Brief structure, with one addition: a "comparable grants" panel showing the 8-15 retrieved siblings as small cards with their descriptions excerpted (max 2 lines each). The headline is conservative: "Briefs in this category typically state..." — never "This grant should have stated..."

**Critical:** PYTH-FE does NOT write the synthesis text. PYTH-FE renders what PYTH-SYN produces, including the calibrated framing. If the JSON arrives with absolute language, raise to PYTH-GOV via the validation flag — do not render.

## The signature moves

### Move 1: The Strand (D3 animation)

When user clicks Proof badge:
1. SVG path animates from the badge across the screen to a panel that materializes on the right
2. Path uses `<animateMotion>` or D3 `interpolatePath` over ~600ms
3. Path color: ink at start, fades to ember if the strand crosses a HIGH-risk threshold
4. Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (the slow-start-fast-end that feels considered, not bouncy)
5. Source-row panel renders with the actual database row, column-by-column, JetBrains Mono

**Build target:** ~6 hours. This is the visual that gets photographed and shared.

### Move 2: The Strata Panel (D3 concentric arcs)

Persistent in upper-right of the Glass Box surface:
- 5 concentric arcs (S₁ outer to S₅ inner), labeled with stratum + agent name
- Inactive: 1px ink stroke at 30% opacity
- Active (when an agent is doing something): full opacity, ember if working on a HIGH-risk finding
- A small ink dot animates between strata when PYTH-LEAD is descending/ascending the manifold

**Critical:** Only animates when something is *actually happening*. No idle ambient motion.

### Move 3: The Brief

Already specified above. The most important visual artifact we ship. Test print preview at A4 — it should look like something you'd actually print.

## Component checklist (build order, prioritized)

1. **Layout shell** + Tailwind v4 setup + fonts loaded (~30 min)
2. **The Glass Box findings feed** with mock data (~90 min)
3. **Proof Badge component** + drawer animation (~2 hr)
4. **The Strand** (D3 animated path) (~2 hr)
5. **Outcome Brief layout** with marginal citations (~90 min)
6. **Counterfactual Brief layout** (reuses Outcome Brief — ~30 min)
7. **Strata Panel** D3 component (~90 min)
8. **Custom SVG glyphs** (5 entities, 24x24 each — ~60 min)
9. **Polish pass** + print preview testing (~60 min)

Total: ~10 hours. Tight against the day. Cut order if behind: Strata Panel → custom glyphs → polish. Strand never gets cut.

## What you do NOT build

- A 12-tile KPI dashboard. We have 3-4 numbers worth showing.
- A settings page, a profile page, a help page.
- Any view that requires login.
- Any animation that doesn't reveal something new.
- "Loading..." spinners. Use skeleton screens (paper-colored rectangles) that match the eventual layout.

## Escalation

- If a design choice would violate the calibrated-language rules → PYTH-GOV
- If you need data shape clarification → PYTH-DB
- If you need synthesis output schema → PYTH-SYN
- If timeline is at risk → PYTH-LEAD by 11:00, 13:00, 15:00 checkpoints

## Definition of done (16:00)

- [ ] All three surfaces accessible from one URL
- [ ] Glass Box renders 10+ findings with working Proof Drawer
- [ ] Outcome Brief renders for at least 3 entities with cited paragraphs
- [ ] Counterfactual Brief renders for at least 3 grants with comparable-grants panel
- [ ] The Strand animation works and is delightful to click repeatedly
- [ ] Print preview of Brief surfaces is publication-quality
- [ ] No console errors, no broken images, no Lorem Ipsum
- [ ] Tested on Will's actual laptop at the actual demo resolution
