"use client";

import { useMemo, useState } from "react";
import type { SuitabilityScore } from "@/lib/types";

/**
 * S2 — Circular suitability score visualization. Center holds composite
 * score; four arcs around it draw to their values over 1200ms with
 * 80ms stagger. Hover any arc: replace center number with that
 * dimension; floating card explains.
 *
 * This is the single most photographed visual in the demo. Built with
 * vanilla SVG + CSS animation — no D3, no Three.js, no library.
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

export function SuitabilityScoreCircle({
  score,
  explanation,
}: {
  score: SuitabilityScore;
  explanation: SuitabilityScore["perComponentExplanation"];
}) {
  const [hover, setHover] = useState<DimId | null>(null);
  const composite = score.composite;
  const verdictColor =
    score.verdict === "PROCEED"
      ? "var(--color-accent)"
      : score.verdict === "CONSOLIDATE"
        ? "var(--color-accent-warn)"
        : "var(--color-accent-fail)";

  // Arc geometry — four concentric quarter-arcs, each occupying 90 degrees
  // of a unit circle starting at -135deg (top-left) clockwise.
  const arcs = useMemo(
    () =>
      DIMS.map((d, i) => {
        const value = score[d.id] as number;
        const display = d.inverted ? 10 - value : value;
        return {
          ...d,
          value,
          display,
          startDeg: -135 + i * 90,
          endDeg: -135 + (i + 1) * 90,
          color: pickArcColor(display, d.inverted ? value : 10 - value),
        };
      }),
    [score],
  );

  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      <svg viewBox="-120 -120 240 240" width="100%" height="auto">
        {/* Background ring */}
        <circle cx="0" cy="0" r="100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Four arcs — each a 90-degree slice */}
        {arcs.map((arc, i) => {
          const r = 92 - i * 14; // concentric inward
          const fraction = arc.display / 10;
          const angleRange = 90 * fraction;
          const start = polar(r, arc.startDeg + 4);
          const end = polar(r, arc.startDeg + 4 + angleRange);
          const largeArc = angleRange > 180 ? 1 : 0;
          const path = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
          const fullPath = `M ${polar(r, arc.startDeg + 4).x} ${polar(r, arc.startDeg + 4).y} A ${r} ${r} 0 0 1 ${polar(r, arc.endDeg - 4).x} ${polar(r, arc.endDeg - 4).y}`;
          const animationLength = 220;
          return (
            <g key={arc.id} onMouseEnter={() => setHover(arc.id)} onMouseLeave={() => setHover(null)}>
              {/* Track */}
              <path d={fullPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" strokeLinecap="round" />
              {/* Filled arc with stroke-dasharray draw-on */}
              <path
                d={fullPath}
                fill="none"
                stroke={arc.color}
                strokeWidth="6"
                strokeLinecap="round"
                style={{
                  strokeDasharray: animationLength,
                  strokeDashoffset: animationLength * (1 - fraction),
                  transition: `stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
                }}
              />
            </g>
          );
        })}

        {/* Center text */}
        <text
          x="0"
          y="-2"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="var(--color-fg-subtle)"
          letterSpacing="0.12em"
          style={{ textTransform: "uppercase" }}
        >
          {hover ? DIMS.find((d) => d.id === hover)?.label : "Suitability"}
        </text>
        <text
          x="0"
          y="32"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="600"
          fontSize="60"
          fill={verdictColor}
        >
          {hover
            ? (() => {
                const arc = arcs.find((a) => a.id === hover)!;
                return arc.display.toFixed(0);
              })()
            : composite}
        </text>
        <text
          x="0"
          y="52"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="11"
          fill="var(--color-fg-subtle)"
        >
          {hover ? "/ 10" : "/ 30"}
        </text>
      </svg>

      {/* Legend */}
      <ul className="mt-8 space-y-2 font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
        {arcs.map((arc) => (
          <li
            key={arc.id}
            onMouseEnter={() => setHover(arc.id)}
            onMouseLeave={() => setHover(null)}
            className={
              "flex items-center justify-between cursor-help transition-colors " +
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

      {/* Floating explanation card on hover */}
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

function polar(r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

function pickArcColor(display: number, raw: number): string {
  if (display >= 7) return "var(--color-accent)";
  if (display >= 4) return "var(--color-accent-warn)";
  return "var(--color-accent-fail)";
}
