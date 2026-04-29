# Design System — Pythagorithm

**Owner:** PYTH-FE
**Status:** Locked. Deviations require PYTH-LEAD approval and a logged decision.

---

## The thesis

Apple-grade cleanliness combined with the motion vocabulary of contemporary editorial-tech (Vercel marketing, Linear marketing, Stripe sessions). Hypermodern. Almost no chrome. Generous whitespace. Typography carries the design — there are no decorative elements except where motion or SVG illustration is doing real work.

## Reference set

Study these before building anything new:

- **apple.com** — current iPhone, Mac, Vision Pro product pages. Full-bleed type, scroll-driven section transitions, restraint in color, hero sections that breathe with whitespace.
- **vercel.com homepage** — typographic scale, subtle gradient meshes used as atmospheric background only, geometric SVG illustrations, text scrolling under sticky navigation.
- **linear.app homepage** — dense feature grids that read as legible because of typographic discipline.
- **stripe.com/sessions and stripe.com/payments** — layered cards, SVG-based product diagrams that animate on scroll.
- **stripe.com/atlas** — storytelling rhythm.

## Color palette

```css
@theme {
  --color-bg:           #0A0A0A;       /* near-black, not pure */
  --color-bg-elev-1:    #131313;       /* cards, elevated surfaces */
  --color-bg-elev-2:    #1C1C1C;       /* modals, drawers */
  --color-fg:           #FAFAFA;       /* near-white text */
  --color-fg-muted:     #A1A1AA;       /* muted body */
  --color-fg-subtle:    #71717A;       /* captions, metadata */
  --color-border:       rgba(255,255,255,0.08);
  --color-border-strong:rgba(255,255,255,0.16);
  --color-accent:       #5EEAD4;       /* signal — active, success, key CTA */
  --color-accent-warn:  #FBBF24;       /* warning amber, calibration flags */
  --color-accent-fail:  #F87171;       /* error coral, high-risk score states */
}
```

**Color rules:**
- Pure white (`#FFFFFF`) is forbidden. Pure black (`#000000`) is forbidden.
- Accent colors carry meaning. They are NEVER decorative.
- Gradient meshes are allowed for atmosphere ONLY: e.g. `radial-gradient(circle at 30% 20%, rgba(94,234,212,0.08), transparent 50%)`. Subtle. Never the focal point.

## Typography

Three faces, all variable, all loaded via `next/font`:

- **Display & body:** Inter Variable (via `next/font/google` with `variable` instance). Weights 400–800. We use Inter for everything that's not data.
- **Mono:** JetBrains Mono Variable.

### Type scale

| Token | Font-size / line-height / tracking |
|---|---|
| `display-xl` | 80px / 80px / -0.04em — homepage hero |
| `display-lg` | 64px / 68px / -0.03em — section heroes |
| `display-md` | 48px / 52px / -0.025em — page titles |
| `display-sm` | 32px / 36px / -0.02em — subheads |
| `heading` | 20px / 28px / -0.01em — card titles |
| `body-lg` | 18px / 28px / 0 — lead paragraphs |
| `body` | 16px / 24px / 0 — default body |
| `body-sm` | 14px / 20px / 0 — secondary body |
| `caption` | 12px / 16px / 0.04em — captions, labels |
| `mono` | 13px / 20px / 0 — data, IDs |

## Spacing scale

`4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160, 192, 256` — use these values only. No arbitrary numbers.

## Elevation

| Layer | Background | Treatment |
|---|---|---|
| 0 | Page | `--color-bg` |
| 1 | Cards | `--color-bg-elev-1`, no shadow, 1px `--color-border-strong` |
| 2 | Modals/drawers | `--color-bg-elev-2`, `0 1px 3px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.6)` |
| 3 | Top-level overlays | `--color-bg-elev-2`, `0 24px 48px rgba(0,0,0,.5), 0 8px 16px rgba(0,0,0,.4)` |

## Motion principles

- **Default easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — the same ease we used before.
- **Default durations:** 200ms hover, 350ms state transitions, 600ms content reveal.
- **Stagger:** 40ms between sibling items entering viewport.
- **Reduced motion:** `prefers-reduced-motion: reduce` collapses all entrance animations to instant.

### Required motion moments

| ID | Trigger | Behavior |
|---|---|---|
| **M1** | Hero on first paint | display-xl headline fades in with `translateY(8px)`, 600ms. Dek follows 100ms later. Search input scales from 0.97 to 1.0 over 400ms. |
| **M2** | Search input focus | Animated border draw on focus, 300ms left-to-right, accent. |
| **M3** | Search results entering | Stagger fade-in, 40ms apart, `translateY(4px)` to 0. |
| **M4** | `/evaluate` score number | Count-up from 0 to value over 1200ms, with subtle scale pulse 1.0→1.02→1.0 on settle. |
| **M5** | Similarity bars | Fill from 0 to value, 800ms, 60ms staggered. |
| **M6** | Stratum descent on click | Synthesized observation expands to source row, then to archival citation. Three layers; each reveals 200ms ease, layered z-translation. The Manifold concept made functional. |
| **M7** | Scroll-driven transitions on `/evaluate` result | Section reveals tied to ScrollTrigger; each section's headline scales slightly down as it leaves viewport top, opacity fades on next section. |
| **M8** | Page transitions | Body fades out 150ms then in 200ms with `translateY(4px)` on route change. |

### SVG motion (the hypermodern moments)

| ID | Where | Behavior |
|---|---|---|
| **S1** | Homepage hero | Animated geometric composition representing structure-from-unstructured-data. Lines drawing themselves; nodes connecting. Strictly monochrome with single accent color. Plays once on load; re-triggerable on hover. |
| **S2** | `/evaluate` result | Circular suitability score: four arcs draw to value over 1200ms with 80ms stagger. Numbers count up inside. |
| **S3** | Anywhere | Similarity bar — animated horizontal bar with the score rendered inside. |
| **S4** | `/record` | Amendment chain timeline — horizontal axis, notches per amendment, dollar value plotted as line height. Notches plot themselves left-to-right on scroll into view. |
| **S5** | `/evaluate` recipient concentration | Horizontal stacked bar where each segment is a recipient. Segments draw left-to-right with stagger. |

## Forbidden patterns

The category-defining "what makes this not look like every other AI demo":

- Purple-to-blue gradients
- Glassmorphism (frosted-glass cards) — we use solid elevation steps
- Sparkles, Bot, Brain, Zap, Wand icons
- "AI" as a visual element or label
- Chat-input pretending to be a hero
- KPI tile dashboards
- Pure white `#FFF`, pure black `#000`
- Lottie animations (use SVG + GSAP for everything)
- Bounce easing or spring physics where Bezier would do
- 3D scenes, WebGL, Three.js, R3F
- Naming Janak Alford anywhere
- The word "Manifold" in any user-facing copy or UI
- Naming Claude, GPT, Bedrock, or any LLM/model in the UI
- Confetti, sound effects, screen shakes
- Tutorial overlays or guided tours
- Background video

## Components — locked specs

### Search input (the centerpiece)
- max-width 720px, height 72px, `--color-bg-elev-1`, 1px `--color-border-strong`, 12px corner radius
- Magnifying-glass SVG (custom, monochrome) at left
- Placeholder italic, `--color-fg-muted`: "Search by topic, recipient, program, or paste a draft excerpt"
- Focus: animated border draw (M2)

### Cards
- `--color-bg-elev-1`, 1px `--color-border-strong`, **24px corner radius** (locked), 32px internal padding
- Hover: lift to elevation 2 (`--color-bg-elev-2`), border becomes `--color-border-strong`, 200ms

### Buttons
- **Primary:** `--color-accent` background, `--color-bg` text, 16px corner radius, 56px tall, body weight 600, 8px right-translate arrow on hover
- **Secondary:** transparent, 1px `--color-border-strong`, `--color-fg`. Hover: border becomes `--color-fg`
- **Ghost:** no border, `--color-fg`, hover underline 2px below baseline

### Form inputs
- 1px `--color-border-strong`, no background, 8px corner radius, 16px padding
- Focus: border becomes `--color-fg`, no ring
- Placeholder: `--color-fg-subtle`

### Loading
- 1px tall accent progress bar at top of viewport, indeterminate
- No "Loading..." text anywhere

### Error copy (calibrated)
- Network failure: "This view requires a connection that's currently unavailable. Cached results below."
- DB query timeout: "The query took longer than expected. Showing prewarmed results."
- LLM synthesis failure: "Synthesis is unavailable. Cached evaluation from [date] shown below."
- No data: "No matches found." (heading), with broader-query suggestions in body-sm muted
- Validation failure (PYTH-GOV): "This output did not pass calibration review. Re-queued."

Never apologize. State the situation. Move on.

## Accessibility (non-negotiable basics)

- All interactive elements keyboard-equivalent (Tab, Enter, Escape, Arrows)
- All meaningful color carries a non-color signal (ember risk also has icon + label)
- Alt text on all meaningful imagery
- WCAG AA contrast on the dark palette (paper on bg = 17.5:1, well above)
- `prefers-reduced-motion` respected
- Focus state: 2px offset outline `--color-accent`

## What "looks like Pythagorithm" looks like

- Could be screenshotted and posted on Twitter and look like a serious investigative-journalism / product-launch hybrid
- Could be printed at A4 and handed to a Deputy Minister without embarrassment
- Has at least one visual moment (the suitability score arcs assembling) that makes someone say "wait, do that again"
- Uses typography as the primary design tool
- Has visible architecture (the descent-to-source interaction) that suggests serious thought
- Is dense enough that a senior public servant feels respected
- Has zero gradients-for-decoration, zero glassmorphism, zero AI-cliché
- Looks like nothing else at the hackathon
