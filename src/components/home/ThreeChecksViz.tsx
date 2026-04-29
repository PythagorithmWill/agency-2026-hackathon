"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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
 * Section C — the dynamic showpiece. Three columns animate in on viewport
 * entry: glyphs fade in with stagger, bars draw left-to-right with their
 * numbers counting up, then convergence lines draw to a single score badge
 * showing "= 14/30".
 */
export function ThreeChecksViz() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="mx-auto max-w-[1200px] px-6 md:px-16 py-32" ref={ref}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease }}
        className="text-center"
      >
        <h2 className="text-[clamp(48px,6vw,72px)] leading-[1.05] tracking-[-0.03em] font-semibold">
          Three checks. One score.
        </h2>
        <p className="mt-4 mx-auto max-w-[600px] italic text-[18px] leading-[28px] text-[var(--color-fg-muted)]">
          Every draft is evaluated against four dimensions. The composite
          score is the recommendation.
        </p>
      </motion.div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12">
        {COLUMNS.map((col, i) => (
          <motion.div
            key={col.id}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.08, duration: 0.6, ease }}
            className="flex flex-col items-start"
          >
            <ColumnGlyph kind={col.glyph} />
            <div className="mt-6 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              {col.label}
            </div>
            <p className="mt-3 italic text-[16px] leading-[24px] text-[var(--color-fg-muted)] min-h-[48px]">
              {col.description}
            </p>
            <div className="mt-6 w-full">
              <BarFill
                target={col.value}
                triggered={inView}
                delayMs={400 + i * 60}
              />
            </div>
            <div className="mt-3 font-[var(--font-mono)] text-[36px] leading-none tracking-[-0.02em] text-[var(--color-fg)]">
              <CountUp
                to={col.value}
                durationMs={1200}
                decimals={2}
                startOnView
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Convergence + score badge */}
      <div className="relative mt-12 flex justify-center">
        <ConvergenceSvg triggered={inView} />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 1.6, duration: 0.4, ease }}
        className="mt-2 flex justify-center"
      >
        <div className="px-8 h-20 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-bg-elev-2)] border border-[var(--color-border-strong)]">
          <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Composite
          </span>
          <span className="font-[var(--font-mono)] text-[42px] leading-none text-[var(--color-fg)] ml-3">
            <CountUp to={14} durationMs={1500} startOnView />
          </span>
          <span className="font-[var(--font-mono)] text-[18px] text-[var(--color-fg-subtle)]">
            / 30
          </span>
        </div>
      </motion.div>
    </section>
  );
}

function BarFill({
  target,
  triggered,
  delayMs,
}: {
  target: number;
  triggered: boolean;
  delayMs: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="h-2 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={triggered ? { width: `${target * 100}%` } : { width: 0 }}
        transition={{
          delay: reduce ? 0 : delayMs / 1000,
          duration: reduce ? 0 : 0.8,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="h-full rounded-full bg-[var(--color-accent)]"
      />
    </div>
  );
}

/** Three converging lines from each column's bottom-center down to a
 *  single point, then a vertical drop to where the badge will render.
 *  Lines draw in sequence on viewport entry. */
function ConvergenceSvg({ triggered }: { triggered: boolean }) {
  const reduce = useReducedMotion();
  // Box: 0..900 wide × 120 tall. Three column anchors + one convergence
  // anchor + drop line.
  const cols = [150, 450, 750];
  const conv = { x: 450, y: 80 };
  const anchorY = 8;
  const lineLength = (x: number) =>
    Math.hypot(conv.x - x, conv.y - anchorY);

  return (
    <svg
      viewBox="0 0 900 130"
      className="w-full max-w-[780px] h-[130px]"
      aria-hidden="true"
    >
      {cols.map((x, i) => {
        const len = lineLength(x);
        return (
          <motion.line
            key={x}
            x1={x}
            y1={anchorY}
            x2={conv.x}
            y2={conv.y}
            stroke="var(--color-border-strong)"
            strokeWidth="1"
            strokeLinecap="round"
            initial={{ strokeDasharray: len, strokeDashoffset: len }}
            animate={
              triggered
                ? {
                    strokeDashoffset: 0,
                    transition: {
                      delay: reduce ? 0 : 1.0 + i * 0.08,
                      duration: reduce ? 0 : 0.6,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }
                : { strokeDashoffset: len }
            }
          />
        );
      })}
      <motion.circle
        cx={conv.x}
        cy={conv.y}
        r="3"
        fill="var(--color-accent)"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          triggered
            ? {
                opacity: 1,
                scale: 1,
                transition: { delay: reduce ? 0 : 1.4, duration: 0.3 },
              }
            : { opacity: 0 }
        }
        style={{ transformOrigin: `${conv.x}px ${conv.y}px` }}
      />
      <motion.line
        x1={conv.x}
        y1={conv.y}
        x2={conv.x}
        y2={120}
        stroke="var(--color-accent)"
        strokeWidth="1"
        strokeLinecap="round"
        initial={{ strokeDasharray: 40, strokeDashoffset: 40 }}
        animate={
          triggered
            ? {
                strokeDashoffset: 0,
                transition: {
                  delay: reduce ? 0 : 1.5,
                  duration: reduce ? 0 : 0.3,
                  ease: [0.16, 1, 0.3, 1],
                },
              }
            : { strokeDashoffset: 40 }
        }
      />
    </svg>
  );
}

function ColumnGlyph({ kind }: { kind: string }) {
  // Reuse the existing glyph set with consistent sizing
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
