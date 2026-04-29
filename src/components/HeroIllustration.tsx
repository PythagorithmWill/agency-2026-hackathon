"use client";

import { useEffect, useRef } from "react";

/**
 * Hero SVG illustration (S1) — geometric composition representing
 * structure-from-unstructured-data. Five strata as horizontal bands,
 * with nodes connecting upward across the bands as scan-lines reveal
 * the structure. Strictly monochrome with single accent color. Plays on
 * mount via CSS animation; re-triggerable via a `key` prop bump.
 */
export function HeroIllustration({ play = true }: { play?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  // Re-trigger animation when `play` flips: rotate a numeric key so React
  // remounts the inner <g>, restarting CSS animations on the path/circle.
  // We use a CSS class with @keyframes; toggle a data attribute to replay.
  useEffect(() => {
    if (!ref.current) return;
    if (play) {
      ref.current.dataset.replay = String(Date.now());
    }
  }, [play]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 640 240"
      width="100%"
      height="auto"
      className="block max-w-[640px] mx-auto"
      role="img"
      aria-label="Structure of comparable spending records"
    >
      <defs>
        <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(250,250,250,0.04)" />
          <stop offset="100%" stopColor="rgba(250,250,250,0.16)" />
        </linearGradient>
      </defs>

      {/* Five horizontal strata as faint hairlines drawing left-to-right */}
      {[40, 80, 120, 160, 200].map((y, i) => (
        <line
          key={y}
          x1="40"
          y1={y}
          x2="600"
          y2={y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          style={{
            strokeDasharray: 560,
            strokeDashoffset: 560,
            animation: `hero-line-draw 900ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms forwards`,
          }}
        />
      ))}

      {/* 14 nodes scattered across the strata; the smaller circles are
          source rows, the larger circles are synthesized observations */}
      {NODES.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.accent ? "var(--color-accent)" : "rgba(250,250,250,0.6)"}
            opacity="0"
            style={{
              animation: `hero-node-fade 450ms cubic-bezier(0.16, 1, 0.3, 1) ${720 + i * 50}ms forwards`,
            }}
          />
          {n.accent && (
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r * 2.2}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1"
              opacity="0"
              style={{
                animation: `hero-node-pulse 1.2s cubic-bezier(0.16, 1, 0.3, 1) ${720 + i * 50}ms forwards`,
              }}
            />
          )}
        </g>
      ))}

      {/* Connectors — strands between observation and source */}
      {STRANDS.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke="rgba(250,250,250,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
          style={{
            strokeDasharray: 220,
            strokeDashoffset: 220,
            animation: `hero-strand-draw 900ms cubic-bezier(0.16, 1, 0.3, 1) ${1300 + i * 80}ms forwards`,
          }}
        />
      ))}

      {/* tiny labels in mono on the right side */}
      {STRATA_LABELS.map((label, i) => (
        <text
          key={label}
          x="612"
          y={[40, 80, 120, 160, 200][i] + 4}
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="rgba(255,255,255,0.36)"
          letterSpacing="0.1em"
          opacity="0"
          style={{
            animation: `hero-node-fade 600ms cubic-bezier(0.16, 1, 0.3, 1) ${1100 + i * 60}ms forwards`,
          }}
        >
          {label}
        </text>
      ))}

      <style>{`
        @keyframes hero-line-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes hero-node-fade {
          to { opacity: 1; }
        }
        @keyframes hero-node-pulse {
          0%   { opacity: 0; transform-origin: var(--cx) var(--cy); transform: scale(0.4); }
          60%  { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.4); }
        }
        @keyframes hero-strand-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

const STRATA_LABELS = ["S1", "S2", "S3", "S4", "S5"];

const NODES: { x: number; y: number; r: number; accent?: boolean }[] = [
  { x: 90, y: 40, r: 3 },
  { x: 240, y: 40, r: 3 },
  { x: 410, y: 40, r: 3 },
  { x: 130, y: 80, r: 3 },
  { x: 310, y: 80, r: 4, accent: true },
  { x: 470, y: 80, r: 3 },
  { x: 200, y: 120, r: 3 },
  { x: 360, y: 120, r: 4, accent: true },
  { x: 540, y: 120, r: 3 },
  { x: 100, y: 160, r: 3 },
  { x: 280, y: 160, r: 3 },
  { x: 460, y: 160, r: 3 },
  { x: 220, y: 200, r: 3 },
  { x: 420, y: 200, r: 3 },
];

// Strands connect a synthesized observation node to two source rows below
const STRANDS: { d: string }[] = [
  { d: "M 310 80 Q 280 110 280 160" },
  { d: "M 310 80 Q 320 110 360 120" },
  { d: "M 360 120 Q 410 150 420 200" },
  { d: "M 360 120 Q 350 150 280 160" },
];
