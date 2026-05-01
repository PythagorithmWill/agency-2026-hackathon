"use client";

import { CountUp } from "../motion/CountUp";

const COLUMNS = [
  {
    id: "similarity",
    label: "Similarity",
    description:
      "The closest existing record has similarity 0.83 with the draft.",
    value: 0.83,
    glyph: "fed",
  },
  {
    id: "concentration",
    label: "Concentration",
    description:
      "Top three recipients account for 71% of comparable funding.",
    value: 0.71,
    glyph: "lobbying",
  },
  {
    id: "language",
    label: "Language",
    description: "Two flagged phrases against the calibrated regex set.",
    value: 0.92,
    glyph: "contract",
  },
] as const;

/**
 * Section C — three columns, three score bars, one composite badge.
 * Reveal animations are CSS-driven (glassbox-fade-up) gated by the
 * parent ScrollReveal wrapper. Bar fills + lines use CSS keyframes
 * (`bar-fill`, `convergence-draw`) so no framer-motion is involved.
 *
 * Removed framer-motion useInView entirely — its observers race with
 * route navigation and trigger React removeChild crashes (Next 15 +
 * React 19 + framer 11). The visual sequence is preserved.
 */
export function ThreeChecksViz() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-16 py-20 sm:py-28 md:py-32">
      <div className="text-center" style={{ animation: "glassbox-fade-up 0.6s ease-out both" }}>
        <h2 className="text-[clamp(48px,6vw,72px)] leading-[1.05] tracking-[-0.03em] font-semibold">
          Three checks. One score.
        </h2>
        <p className="mt-4 mx-auto max-w-[600px] italic text-[18px] leading-[28px] text-[var(--color-fg-muted)]">
          Every draft is evaluated against four dimensions. The composite score
          is the recommendation.
        </p>
      </div>

      <div className="mt-12 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12">
        {COLUMNS.map((col, i) => (
          <div
            key={col.id}
            className="flex flex-col items-start"
            style={{ animation: `glassbox-fade-up 0.6s ease-out ${0.15 + i * 0.08}s both` }}
          >
            <ColumnGlyph kind={col.glyph} />
            <div className="mt-6 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              {col.label}
            </div>
            <p className="mt-3 italic text-[16px] leading-[24px] text-[var(--color-fg-muted)] min-h-[48px]">
              {col.description}
            </p>
            <div className="mt-6 w-full">
              <BarFill target={col.value} delaySec={0.4 + i * 0.06} />
            </div>
            <div className="mt-3 font-[var(--font-mono)] text-[36px] leading-none tracking-[-0.02em] text-[var(--color-fg)]">
              <CountUp to={col.value} durationMs={1200} decimals={2} startOnView />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-12 flex justify-center">
        <ConvergenceSvg />
      </div>

      <div
        className="mt-2 flex justify-center"
        style={{ animation: "glassbox-fade-up 0.4s ease-out 1.6s both" }}
      >
        <div className="px-5 sm:px-8 h-16 sm:h-20 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-bg-elev-2)] border border-[var(--color-border-strong)]">
          <span className="font-[var(--font-mono)] text-[11px] sm:text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Composite
          </span>
          <span className="font-[var(--font-mono)] text-[32px] sm:text-[42px] leading-none text-[var(--color-fg)] ml-2 sm:ml-3">
            <CountUp to={14} durationMs={1500} startOnView />
          </span>
          <span className="font-[var(--font-mono)] text-[15px] sm:text-[18px] text-[var(--color-fg-subtle)]">
            / 30
          </span>
        </div>
      </div>
    </section>
  );
}

function BarFill({ target, delaySec }: { target: number; delaySec: number }) {
  return (
    <div className="h-2 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-[var(--color-accent)]"
        style={{
          width: `${target * 100}%`,
          transformOrigin: "left center",
          animation: `bar-fill 0.8s cubic-bezier(0.16,1,0.3,1) ${delaySec}s both`,
        }}
      />
    </div>
  );
}

/** Three converging lines from each column's bottom-center down to a
 *  single point, then a vertical drop. Pure CSS stroke-dashoffset draw. */
function ConvergenceSvg() {
  const cols = [150, 450, 750];
  const conv = { x: 450, y: 80 };
  const anchorY = 8;

  return (
    <svg viewBox="0 0 900 130" className="w-full max-w-[780px] h-[130px]" aria-hidden="true">
      {cols.map((x, i) => {
        const len = Math.hypot(conv.x - x, conv.y - anchorY);
        return (
          <line
            key={x}
            x1={x}
            y1={anchorY}
            x2={conv.x}
            y2={conv.y}
            stroke="var(--color-border-strong)"
            strokeWidth="1"
            strokeLinecap="round"
            style={{
              strokeDasharray: len,
              strokeDashoffset: len,
              animation: `convergence-draw-${len.toFixed(0)} 0.6s cubic-bezier(0.16,1,0.3,1) ${1.0 + i * 0.08}s forwards`,
            }}
          >
            <style>{`@keyframes convergence-draw-${len.toFixed(0)} { to { stroke-dashoffset: 0; } }`}</style>
          </line>
        );
      })}
      <circle
        cx={conv.x}
        cy={conv.y}
        r="3"
        fill="var(--color-accent)"
        style={{
          opacity: 0,
          transformOrigin: `${conv.x}px ${conv.y}px`,
          transform: "scale(0.6)",
          animation: "convergence-dot 0.3s ease-out 1.4s forwards",
        }}
      />
      <line
        x1={conv.x}
        y1={conv.y}
        x2={conv.x}
        y2={120}
        stroke="var(--color-accent)"
        strokeWidth="1"
        strokeLinecap="round"
        style={{
          strokeDasharray: 40,
          strokeDashoffset: 40,
          animation: "convergence-drop 0.3s cubic-bezier(0.16,1,0.3,1) 1.5s forwards",
        }}
      />
    </svg>
  );
}

function ColumnGlyph({ kind }: { kind: string }) {
  const props = {
    width: 36,
    height: 36,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "text-[var(--color-accent)]",
  };
  if (kind === "fed") {
    return (
      <svg {...props}>
        <path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0V3Z" />
        <path d="M16 3v3h3" />
        <path d="M12 9.5l1.2 2.4 2.6-.4-1.4 2.2 1.6 1.7-2.4.5-.4 2.6-1.2-1.5-1.2 1.5-.4-2.6-2.4-.5 1.6-1.7-1.4-2.2 2.6.4Z" />
      </svg>
    );
  }
  if (kind === "lobbying") {
    return (
      <svg {...props}>
        <path d="M9 3v10a3 3 0 0 0 6 0V5a1.5 1.5 0 0 0-3 0v8" />
        <path d="M5 11v8a3 3 0 0 0 6 0v-8a1.5 1.5 0 0 0-3 0v6" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M4 3h11l3 3v15H4Z" />
      <path d="M15 3v3h3" />
      <path d="M7 10h7" />
      <path d="M7 13h7" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="M15.6 16.1l2.8 2.8" />
      <path d="M18.4 16.1l-2.8 2.8" />
    </svg>
  );
}
