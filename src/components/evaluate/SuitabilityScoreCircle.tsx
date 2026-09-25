"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import type { SuitabilityScore } from "@/lib/types";

/**
 * S2 — Circular suitability score visualization.
 *
 * Three layers, outside-in:
 *   1. A radial tick scale: 60 ticks at 6°, every 10th taller. Lit ticks =
 *      composite / 30 of the ring, starting at 12 o'clock and running
 *      clockwise; unlit ticks are subdued. This is the composite gauge.
 *   2. Four dimension arcs on ONE ring, each a 90° sector (minus a gap),
 *      drawing to their value over 1200ms with 80ms stagger. Hover any arc
 *      (or its legend row) to read that dimension in the centre.
 *   3. The composite number, with the "suitability" caption BELOW it —
 *      never behind it.
 *
 * Vanilla SVG + CSS transitions. No HTML inside the SVG (an HTML <span>
 * inside <text> broke hydration and blanked the score once before).
 */
type DimId =
  | "uniqueness"
  | "duplicationRisk"
  | "recipientConcentration"
  | "languageCalibration";

const DIMS: ReadonlyArray<{ id: DimId; label: string; inverted?: boolean }> = [
  { id: "uniqueness", label: "Uniqueness" },
  { id: "duplicationRisk", label: "Duplication risk", inverted: true },
  { id: "recipientConcentration", label: "Recipient concentration", inverted: true },
  { id: "languageCalibration", label: "Language calibration" },
];

const TICK_COUNT = 60;
const TICK_STEP_DEG = 360 / TICK_COUNT;
const TICK_R_OUTER = 112;
const TICK_R_MINOR = 106;
const TICK_R_MAJOR = 102;
const ARC_R = 86;
const ARC_GAP_DEG = 5;
const COMPOSITE_MAX = 30;

export function SuitabilityScoreCircle({
  score,
  explanation,
}: {
  score: SuitabilityScore;
  explanation: SuitabilityScore["perComponentExplanation"];
}) {
  const [hover, setHover] = useState<DimId | null>(null);
  const composite = clamp(Number(score.composite), 0, COMPOSITE_MAX);
  const verdictColor =
    score.verdict === "PROCEED"
      ? "var(--color-accent)"
      : score.verdict === "CONSOLIDATE"
        ? "var(--color-accent-warn)"
        : "var(--color-accent-fail)";

  const arcs = useMemo(
    () =>
      DIMS.map((d, i) => {
        const value = clamp(Number(score[d.id]), 0, 10);
        const display = d.inverted ? 10 - value : value;
        return {
          ...d,
          value,
          display,
          startDeg: -90 + i * 90,
          endDeg: -90 + (i + 1) * 90,
          color: pickArcColor(display),
        };
      }),
    [score],
  );

  // Tick geometry is static; only the lit/unlit state depends on the score.
  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => {
        const deg = -90 + i * TICK_STEP_DEG;
        const major = i % 10 === 0;
        return {
          i,
          major,
          a: polar(major ? TICK_R_MAJOR : TICK_R_MINOR, deg),
          b: polar(TICK_R_OUTER, deg),
        };
      }),
    [],
  );
  const litCount = Math.round((composite / COMPOSITE_MAX) * TICK_COUNT);

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();
  const settled = reduce || inView;

  // Composite count-up rendered as plain SVG text (see header comment).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(composite);
      return;
    }
    const durationMs = 1500;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 5);
      setShown(eased * composite);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, composite]);

  const hovered = hover ? arcs.find((a) => a.id === hover) : null;
  const centreNumber = hovered ? hovered.display.toFixed(0) : shown.toFixed(0);
  const centreColor = hovered ? hovered.color : verdictColor;

  return (
    <div ref={ref} className="relative w-full max-w-[480px] mx-auto">
      <motion.svg
        viewBox="-120 -120 240 240"
        width="100%"
        role="img"
        aria-label={`Suitability score ${composite.toFixed(0)} of ${COMPOSITE_MAX}`}
        animate={
          reduce
            ? undefined
            : inView
              ? { scale: [1, 1.02, 1], transition: { delay: 1.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
              : { scale: 1 }
        }
      >
        {/* 1. Radial tick scale — the composite gauge */}
        <g strokeLinecap="round" aria-hidden>
          {ticks.map((t) => {
            const lit = settled && t.i < litCount;
            return (
              <line
                key={t.i}
                x1={t.a.x}
                y1={t.a.y}
                x2={t.b.x}
                y2={t.b.y}
                stroke={lit ? verdictColor : "rgba(255,255,255,0.14)"}
                strokeWidth={t.major ? 2 : 1.25}
                style={{
                  opacity: lit ? 1 : t.major ? 0.9 : 0.6,
                  transition: reduce
                    ? undefined
                    : `stroke 350ms ease-out ${t.i * 14}ms, opacity 350ms ease-out ${t.i * 14}ms`,
                }}
              />
            );
          })}
        </g>

        {/* Hairline ring separating the scale from the dimension arcs */}
        <circle cx="0" cy="0" r="96" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* 2. Four dimension arcs on a single ring */}
        {arcs.map((arc, i) => {
          const fraction = arc.display / 10;
          const a0 = polar(ARC_R, arc.startDeg + ARC_GAP_DEG);
          const a1 = polar(ARC_R, arc.endDeg - ARC_GAP_DEG);
          // Coordinates are rounded: Node and browser Math.cos/sin print
          // different trailing digits, which produced a hydration mismatch
          // on the `d` attribute.
          const fullPath = `M ${a0.x} ${a0.y} A ${ARC_R} ${ARC_R} 0 0 1 ${a1.x} ${a1.y}`;
          const arcLength = Math.ceil(((90 - 2 * ARC_GAP_DEG) / 360) * 2 * Math.PI * ARC_R) + 2;
          const targetOffset = arcLength * (1 - fraction);
          const dim = hover !== null && hover !== arc.id;
          return (
            <g
              key={arc.id}
              onMouseEnter={() => setHover(arc.id)}
              onMouseLeave={() => setHover(null)}
              style={{ opacity: dim ? 0.35 : 1, transition: "opacity 200ms ease-out" }}
            >
              {/* Track */}
              <path d={fullPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
              {/* Fill — stroke-dasharray draw-on */}
              <path
                d={fullPath}
                fill="none"
                stroke={arc.color}
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  strokeDasharray: arcLength,
                  strokeDashoffset: settled ? targetOffset : arcLength,
                  transition: reduce
                    ? undefined
                    : `stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
                }}
              />
              {/* Wide invisible hit area so the thin arc is easy to hover */}
              <path d={fullPath} fill="none" stroke="transparent" strokeWidth="18" />
            </g>
          );
        })}

        {/* 3. Centre: number, then caption BELOW it */}
        <text
          x="0"
          y="14"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="600"
          fontSize="56"
          letterSpacing="-0.03em"
          fill={centreColor}
          style={{ transition: "fill 200ms ease-out" }}
        >
          {centreNumber}
        </text>
        <text
          x="0"
          y="34"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8.5"
          fill="var(--color-fg-subtle)"
          letterSpacing="0.14em"
        >
          {hovered ? `${hovered.label.toUpperCase()} · / 10` : `SUITABILITY · / ${COMPOSITE_MAX}`}
        </text>
      </motion.svg>

      {/* Legend */}
      <ul className="mt-8 space-y-2 font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
        {arcs.map((arc) => (
          <li
            key={arc.id}
            onMouseEnter={() => setHover(arc.id)}
            onMouseLeave={() => setHover(null)}
            className={
              "flex items-center justify-between cursor-pointer transition-colors " +
              (hover === arc.id ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]")
            }
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-1.5 w-3 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              {arc.label}
            </span>
            <span style={{ color: arc.color }}>{arc.display.toFixed(0)} / 10</span>
          </li>
        ))}
      </ul>

      {/* Explanation on hover: inline below the legend (all widths) ... */}
      {hover && (
        <p className="mt-3 xl:hidden text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg-muted)] border-l-2 border-[var(--color-border-strong)] pl-3">
          <span className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            {DIMS.find((d) => d.id === hover)?.label} ·{" "}
          </span>
          {explanation[hover]}
        </p>
      )}
      {/* ... and as a floating card beside the circle on wide screens */}
      {hover && (
        <div className="absolute top-1/2 left-full ml-8 -translate-y-1/2 hidden xl:block w-[280px] rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
          <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            {DIMS.find((d) => d.id === hover)?.label}
          </div>
          <p className="mt-2 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg)]">
            {explanation[hover]}
          </p>
        </div>
      )}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function polar(r: number, deg: number): { x: string; y: string } {
  const rad = (deg * Math.PI) / 180;
  return { x: (Math.cos(rad) * r).toFixed(2), y: (Math.sin(rad) * r).toFixed(2) };
}

function pickArcColor(display: number): string {
  if (display >= 7) return "var(--color-accent)";
  if (display >= 4) return "var(--color-accent-warn)";
  return "var(--color-accent-fail)";
}
