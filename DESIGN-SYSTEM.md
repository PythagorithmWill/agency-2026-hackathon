# Design System — Agency 2026

**Owner:** PYTH-FE
**Read by:** PYTH-FE primary; PYTH-DEMO secondary; all other agents reference for context
**Status:** Locked. Deviations require PYTH-LEAD approval and a logged decision.

---

## The thesis

This UI exists to make AI-driven governance findings feel like serious journalism, not like a SaaS product.

The audience is senior public servants, Ministers, Deputy Ministers, and the Office of the Auditor General. People who read Auditor General reports for fun. They are not impressed by glassmorphism, animated gradients, purple-blue color schemes, or any of the visual language that has become AI-product shorthand. They are impressed by editorial weight, confident typography, density done right, and visual evidence of thought.

**The reference set is journalism, archives, and government design — never SaaS:**
- Financial Times long-form web reports
- ProPublica investigative interactives (especially "Dollars for Docs" and "Surgeon Scorecard")
- Texas Tribune data journalism
- The New York Times' "Snow Fall" lineage (without the parallax)
- UK Government Digital Service (GOV.UK) typography discipline
- Archival library catalogue interfaces (deep, dense, navigable)
- Bloomberg Terminal density without the maximalist ugly
- Edward Tufte's data-ink ratio, applied as taste not as rule

**The references we explicitly reject:**
- Linear, Vercel, Stripe (too SaaS)
- Notion, Figma (too playful)
- ChatGPT, Claude, Anthropic Console (too AI-product)
- Anything with a purple-to-blue gradient
- Anything with a glassmorphism card
- Anything with an "AI sparkle" emoji or the word "AI" in 60-point type

## The four design moves that make this different

These are non-negotiable and they are what separates this UI from a generic AI dashboard. PYTH-FE prioritizes these above all else.

### Move 1 — The Strand (the signature animation)

When a user clicks a Proof badge, a curved SVG path draws itself across the screen from the badge to a panel that materializes showing the source row.

**This is the single most important visual moment in the entire build.** Every demo conversation will involve this animation. It must be flawless on first click and rewarding to watch repeatedly.

**Specification:**
- SVG path interpolated via D3's `d3.interpolatePath` or a manual cubic-Bézier curve
- Total duration: 600ms
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — slow-start-fast-end, the curve that feels considered rather than bouncy
- Stroke width: 1.5px at start, 2.5px at midpoint, 1.5px at end (the line "breathes" as it draws)
- Color: starts at `--color-paper` (warm off-white). If the strand crosses a HIGH-risk threshold (any tier showing ember in the Proof token), the path color shifts to `--color-ember` over the second half of the animation. This shift is content-meaningful, not decorative.
- Path geometry: NOT a straight line. NOT a simple arc. It's a curved Bézier with the control points pulled toward the visual center of the screen, so the line bows inward — gives it the quality of a thread drawn taut between two points
- On animation complete: the source-row panel fades in (200ms ease) showing the underlying database row in JetBrains Mono, column-by-column
- On second click: the strand reverses (panel fades out first, then strand retracts)

**Reference for the feel:** the way a librarian draws a single line on a card to indicate provenance. Confident, deliberate, archival. Not a particle effect. Not a network-graph animation. A line.

### Move 2 — The Strata Panel (the architectural tell)

A persistent panel in the upper-right of the Glass Box surface showing five concentric arcs (S₁ outer through S₅ inner), each labeled with the stratum and the agent currently inhabiting it (PYTH-LEAD on S₁, PYTH-DB on S₄, etc.).

**Why it's important:** This is the visible artifact of the Manifold framing. When someone asks "how is your AI organized," you click a finding and they watch a small ink dot animate from S₁ down to S₄ along a strand, lighting up the strata it traverses.

**Specification:**
- D3-rendered concentric arcs, labeled in JetBrains Mono small (12pt)
- Inactive arcs: 1px stroke at 30% opacity in `--color-rule`
- Active arc (when an agent is doing something): full opacity in `--color-paper`, with a faint inner glow
- HIGH-risk activity: arc and traversing dot shift to `--color-ember`
- Cleared/passed activity: subtle `--color-sage` pulse
- Traversing dot: 6px radius, animates between arcs over 800ms with the same easing as the Strand
- Only animates when something is actually happening. NO IDLE AMBIENT MOTION. The panel is still 95% of the time. When it moves, it means something.

**Reference for the feel:** an old radar display, but quieter. Or a geological cross-section diagram. Something that suggests structure rather than spectacle.

### Move 3 — The Brief (the showpiece document)

Outcome Brief and Counterfactual Brief outputs are the documents that get screenshotted, shared, and printed. They must look like something a Minister would actually print and hand to their chief of staff.

**Specification:**
- Single-column, max-width 720px (this matters — wider columns destroy reading rhythm)
- Tiempos-style display headline in **Fraunces** (700 weight, optical-size variable axis dialed up for display use, letter-spacing -0.02em)
- Body in **General Sans** (400 weight, 18px on desktop, 1.55 line-height)
- A single pull-quote in Fraunces italic (500 weight), larger than body, between paragraphs three and four
- Citations as **marginal notes** to the right of the body column on desktop (not footnotes — marginal notes, the way scholarly editions handle them). On mobile, citations collapse inline as expandable references
- Inline data viz: max 200px tall, monochrome, sits inside the column flow without breaking it
- Proof token strip across the bottom: four pills (Tier 1-4), JetBrains Mono labels, sage/ember per tier
- The whole document is responsive but the desktop view is the canonical one — that's the view that gets printed

**Print preview is a feature, not an afterthought.** A4 print preview must look publication-quality with no UI chrome bleed-through.

**Reference for the feel:** the FT Weekend Magazine long-read web layout. Or a New Yorker investigative piece. Editorial gravity.

### Move 4 — Custom domain glyphs (the visual signature)

Generic Lucide icons are fine for utility (search, arrow, info). They are NOT fine for the entities our system actually deals with. Charity, federal grant, AB grant, lobbying registration, donation, contract, AIA-registered AI system — these get **custom monochrome SVG glyphs**.

**Why this matters more than it seems:** When someone screenshots our UI for Twitter or a memo, the icons in the screenshot are part of the visual identity. Generic Lucide icons make us look like every other Tailwind UI. Custom glyphs make us recognizable.

**Specification:**
- 24x24 viewport, monochrome, `currentColor` fill for theming
- Drawn at 1.5px stroke weight, line-cap round, line-join round
- Each glyph is a single-concept abstraction, not an illustration:
  - Charity: a small building with a heart shape integrated into the entrance
  - Federal grant: a maple leaf inside a document outline (NOT just a maple leaf — the document frame matters)
  - AB grant: an Alberta wild rose silhouette inside a document outline
  - Lobbying registration: two interlocking paper-clip shapes (suggesting linkage, paperwork, formality)
  - Donation: an upward arrow that becomes a hand at the top
  - Contract: a document with a wax-seal circle in the corner
  - AIA-registered AI system: a cube with a small inspection-glass loupe overlapping its corner
- All glyphs share a visual family: same stroke weight, same corner radius, same negative-space discipline
- Saved in `/components/glyphs/` as individual `.tsx` files, each exporting a single component

**Reference for the feel:** the Public Domain Review's editorial illustrations, or the Penguin Classics colophons. Spare, recognizable, considered.

## Color system

Editorial dark. Warm. Photographic. Three-color discipline plus two signal colors. No exceptions.

```css
@theme {
  /* Foundation */
  --color-ink: #1A1816;          /* background — warm near-black, NOT pure #000 */
  --color-paper: #F0EBE2;        /* primary text — warm off-white */
  --color-vellum: #252220;       /* panels, cards — one shade lighter than ink */
  --color-vellum-2: #2D2A28;     /* hover state on vellum */
  --color-rule: #3A3633;         /* 1px dividers */
  --color-muted: #8A8580;        /* secondary text, captions */

  /* Signal colors — content-meaningful only */
  --color-ember: #E8693C;        /* HIGH risk; calibration leak; failure */
  --color-ember-soft: #B85A38;   /* less attention-grabbing variant for backgrounds */
  --color-sage: #6B8E7F;         /* cleared; passed all gates; success */
  --color-sage-soft: #56776A;    /* less attention-grabbing variant */
}
```

**Color usage rules:**
- Ember and Sage carry meaning. They are NEVER decorative. If you find yourself using ember "because it looks good," remove it.
- No other colors. No blues, greens, purples, yellows. The discipline is the design.
- Gradients are forbidden. The closest we get is a 5% opacity color wash on a vellum panel for emphasis.
- Pure white (`#FFFFFF`) is forbidden. It blows out on projection screens and reads as cheap. Paper is the lightest tone that exists.
- Pure black (`#000000`) is forbidden. Same reason inverted.

## Typography

Three faces, locked. All free for commercial use, no licensing concerns.

```css
@theme {
  --font-sans: "General Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

**General Sans** (Indian Type Foundry, free for commercial use) — UI body and emphasis. A neo-grotesque with personality. Stylistic alternates `ss01` and `ss02` enabled by default for the more distinctive single-story `a` and `g`.

**Fraunces** (OFL, free for any use) — display headlines and pull quotes. A variable-axis serif with optical-size and "soft" axis. For display use, set `font-variation-settings: "opsz" 144, "SOFT" 0`. For body italic (rare — only in pull quotes), `"opsz" 36, "SOFT" 50`.

**JetBrains Mono** (free) — data, numbers, code, Proof token JSON, source-row panel. The default font for any text that represents structured information.

**Type scale:**
```css
--text-display-1: 4.25rem;     /* 68px — the showpiece headline on a Brief */
--text-display-2: 3rem;         /* 48px — section headers on Briefs */
--text-h1: 2rem;                /* 32px — Glass Box main title */
--text-h2: 1.5rem;              /* 24px — finding card entity name */
--text-body: 1.125rem;          /* 18px — body copy on Briefs */
--text-body-ui: 1rem;           /* 16px — body copy in UI surfaces */
--text-small: 0.875rem;         /* 14px — captions, metadata */
--text-mono: 0.9375rem;         /* 15px — data displays */
--text-micro: 0.75rem;          /* 12px — micro-labels on the Strata Panel */

--tracking-display: -0.02em;
--tracking-tight: -0.01em;
--tracking-normal: 0;
--tracking-wide: 0.04em;        /* small caps on metadata labels */
```

**Type usage rules:**
- Headlines on Briefs use Fraunces with `font-feature-settings: "ss01"` — gets the distinctive single-story `a`
- Numbers in any score, dollar amount, or count use JetBrains Mono. Always. Mixing proportional digits with editorial body copy looks amateur.
- Body copy is General Sans 400 with `font-feature-settings: "ss01", "ss02"` enabled
- Pull quotes are Fraunces 500 italic, 1.4× the body size, with em-dash attribution beneath in General Sans 400 small caps
- All-caps labels (rare — only on metadata) use General Sans with `letter-spacing: 0.04em`. Never Fraunces all-caps.

## Motion principles

Motion exists to reveal something the user couldn't see before. No motion exists for its own sake.

**Allowed motion:**
- The Strand (described above) — reveals provenance
- The Strata Panel agent traversal (described above) — reveals which agent is working
- Layout transitions when surfaces change (250ms ease) — reveals the new structure
- Hover states on interactive elements (150ms ease, opacity or border only) — reveals interactivity
- Brief streaming SSR (paragraphs appear as the LLM completes them) — reveals generation
- Skeleton loading states for data fetches (250ms shimmer) — reveals progress

**Forbidden motion:**
- Parallax (anywhere, ever)
- Animated gradients
- Particle effects
- Floating elements
- Auto-playing carousels
- Lottie animations
- Bounce effects (`cubic-bezier(0.68, -0.55, 0.265, 1.55)` and friends)
- Spring physics where Bézier easing would do
- Staggered reveal-on-scroll
- Hero animations on page load
- Background video
- Animated SVG icons that move when not interacted with

**Easing standard:**
- `cubic-bezier(0.16, 1, 0.3, 1)` for almost everything — feels considered
- `cubic-bezier(0.7, 0, 0.84, 0)` for elements leaving the viewport
- `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) for hover states
- Never the default browser `ease` — always specify

**Motion accessibility:**
- Respect `prefers-reduced-motion: reduce`. When set, the Strand draws instantly (no animation), the Strata Panel doesn't pulse, layout transitions become instant. Content discipline doesn't change.

## Layout principles

### Density done right beats minimalism

The audience reads Auditor General reports for fun. They are not impressed by three KPI tiles on a 4K screen. Show them twelve well-laid-out facts and they'll appreciate the respect.

**Glass Box at desktop breakpoint (≥1280px):**
- Two-column 70/30 split
- Left column scrollable findings feed (50+ entities visible without scrolling on most monitors)
- Right column three stacked panels: Strata Panel (~25%), AIA Register (~25%), Proof Drawer (~50%)
- 32px gutter between columns
- Each finding card: 1px rule top and bottom, 16px vertical padding, no card backgrounds (the rule alone is enough — card backgrounds make the feed look like a SaaS product)

**Brief at desktop breakpoint:**
- Single column max-width 720px, centered
- Marginal-notes column to the right of body, 200px wide, gap 32px
- Total content width 720 + 32 + 200 = 952px
- Whitespace above the headline is 96px (room for the title to breathe)
- Whitespace below the proof token strip is 64px (room for the document to feel finished)

### Mobile

The demo is desktop-first. We are not optimizing for mobile. But mobile must not be broken — Will may need to demo from his phone in a worst-case scenario.

**Mobile rules:**
- Single column everywhere
- Marginal notes collapse inline as expandable references
- Strata Panel hides (it's a desktop-only luxury)
- AIA Register becomes a horizontal-scroll strip
- Strand animation works but with shortened path geometry

## Component-level rules

### Cards

We use very few cards. Most surfaces are list-of-rule-separated-rows.

When we do use cards (Proof Drawer, AIA Register rows), they are:
- `--color-vellum` background
- 1px border in `--color-rule`
- 24px internal padding
- 8px border-radius (NOT 12, NOT 16, NOT 4 — 8 is the locked value)
- No drop shadows. Ever. We are not on iOS in 2014.

### Buttons

Three button styles, no more.

**Primary** (rare — used only for the highest-priority CTA on a screen):
- Background `--color-paper`, text `--color-ink`
- 1px border same as background
- 12px vertical padding, 24px horizontal padding
- General Sans 500 weight, 16px
- Border-radius 6px

**Secondary** (the default button style):
- Transparent background, 1px border `--color-rule`, text `--color-paper`
- Hover: border becomes `--color-paper`, no background change
- Same padding and radius as primary

**Ghost** (for tertiary actions, especially in dense interfaces):
- No border, no background, just text in `--color-paper`
- Hover: 1px underline 2px below baseline, in `--color-paper`
- Used for "view details", "see source", "expand"

**No icon-only buttons larger than 32x32.** Icon-only buttons are tooltips waiting to fail in a high-pressure demo. We use icon+label or label-only.

### Form inputs

The demo has very few form inputs (search box, postal code lookup if Citizen Lookup ships).

When we do use inputs:
- 1px border `--color-rule`, no background
- Border becomes `--color-paper` on focus (not a focus ring — the border itself changes)
- Text in `--color-paper`, placeholder in `--color-muted`
- 12px vertical padding, 16px horizontal padding
- Border-radius 6px
- General Sans 400, 16px

### Loading states

Skeleton screens, not spinners. A spinner is a SaaS tell.

**Skeleton specification:**
- Same shape as the eventual content (a finding card skeleton has the same dimensions as a real finding card)
- Background `--color-vellum`
- Subtle 250ms shimmer using `linear-gradient` with three stops (vellum → vellum-2 → vellum)
- The shimmer moves left-to-right, never bounces

### Error states

Calibrated language applies to errors too. We do NOT say "Something went wrong!" or "Oops!" or use sad emoji.

**Locked error copy patterns:**
- Network failure: "This view requires a connection that's currently unavailable. Cached results below."
- DB query timeout: "The query took longer than expected. Showing prewarmed results."
- LLM synthesis failure: "Synthesis is unavailable. The cached brief from [date] is shown below."
- No data: "No records match this query. The data scope is documented at [link]."
- Validation failure (caught by PYTH-GOV): "This output did not pass calibration review. The synthesis has been re-queued."

Never apologize. State the situation. Provide the alternative. Move on.

## Accessibility (non-negotiable basics)

This is government audience. Accessibility is not optional.

- All interactive elements have keyboard equivalents (Tab, Enter, Escape, Arrow keys)
- All meaningful color carries a non-color signal (ember risk also carries an icon and label)
- All images have meaningful alt text
- All color combinations meet WCAG AA contrast ratios on the editorial dark palette (we've already chosen tones that pass — paper on ink is 13.4:1)
- `prefers-reduced-motion` respected
- Focus states are visible and use a single style: 2px offset outline in `--color-paper`

## What "looks generic AI" looks like — and how to avoid it

If you find yourself doing any of these, stop:
- Reaching for a purple or blue gradient
- Adding a sparkle icon next to anything
- Using "AI" as a label or visual element
- Putting "Powered by Claude" or "Powered by GPT-4" or "Built with Bedrock" anywhere in the UI
- Adding a chat-style input box because "AI products have those"
- Animating elements on page load to "feel alive"
- Using a glassmorphism card for a hero element
- Putting a stylized robot, brain, or neural-net visualization anywhere
- Using lucide's `<Sparkles />`, `<Bot />`, `<Brain />`, or `<Zap />` icons
- Mentioning the model name visibly in any UI text
- Adding a "Type a question" hero on the home page
- Building a generic dashboard with three KPI tiles, a chart, and a list

If you find yourself doing any of these, you've fallen into the SaaS-AI trap. Stop. Look at the FT, ProPublica, or GOV.UK. Re-orient.

## What "looks like Pythagorithm" looks like

If the UI carries these qualities, you're on track:
- Could be screenshotted and posted on Twitter and look like a serious investigative-journalism piece
- Could be printed at A4 and handed to a Deputy Minister without embarrassment
- Has at least one visual moment (the Strand) that makes someone say "wait, do that again"
- Uses typography as the primary design tool (the type does most of the work, color does very little)
- Has visible architecture (Strata Panel, Proof token tier strips) that suggests serious thought
- Is dense enough that a senior public servant feels respected, not condescended to
- Has zero gradients, zero glassmorphism, zero AI-cliché
- Looks like nothing else at the hackathon

## Reference assembly (for inspiration only — do NOT copy directly)

Bookmark these tonight if you have a free moment:
- ft.com — any of the Big Read pieces, or the Lex column treatments
- propublica.org/article/dollars-for-docs — payment-tracking interactive
- texastribune.org/series/borderline — investigative interactive
- gov.uk/transformation — design system in production
- pudding.cool — data essays with strong typographic discipline
- nytimes.com/interactive (any recent investigative interactive)

Do not literally copy any of these. Absorb the typography, the motion restraint, the editorial gravity. Apply the same principles to our specific governance domain.

---

**Last reminder:** the audience is reading Auditor General reports for fun. They will recognize and reward seriousness. Build accordingly.
