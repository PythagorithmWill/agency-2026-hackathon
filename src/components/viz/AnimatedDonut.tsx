"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Slice {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  slices: ReadonlyArray<Slice>;
  size?: number;
  thickness?: number;
  /** Optional center label */
  centerLabel?: string;
  centerSubtext?: string;
}

const DEFAULT_PALETTE = [
  "#5EEAD4", // teal accent
  "#FBBF24", // warn
  "#F87171", // fail
  "#A78BFA", // (rare use; kept neutral)
  "#94A3B8",
  "#52525B",
];

/**
 * SVG donut chart with stroke-dasharray-driven slice growth animation.
 * Static labels in a flexible legend below.
 */
export function AnimatedDonut({
  slices,
  size = 220,
  thickness = 28,
  centerLabel,
  centerSubtext,
}: Props) {
  const reduce = useReducedMotion();
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeFraction = 0;
  const arcs = slices.map((s, i) => {
    const fraction = total > 0 ? Math.max(0, s.value) / total : 0;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const offset = -cumulativeFraction * circumference;
    const out = {
      ...s,
      color: s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      dash,
      gap,
      offset,
      fraction,
    };
    cumulativeFraction += fraction;
    return out;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={thickness}
          />
          {arcs.map((a, i) => (
            <motion.circle
              key={`${a.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
              initial={reduce ? false : { strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${a.dash} ${a.gap}` }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </svg>
        {(centerLabel || centerSubtext) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {centerLabel && (
              <div className="text-[24px] tracking-[var(--tracking-display-sm)] font-[var(--font-display)]">
                {centerLabel}
              </div>
            )}
            {centerSubtext && (
              <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                {centerSubtext}
              </div>
            )}
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] justify-center max-w-[420px]">
        {arcs.map((a, i) => (
          <li key={`${a.label}-legend-${i}`} className="flex items-center gap-2">
            <span
              className="block h-2 w-2 rounded-full"
              style={{ background: a.color }}
            />
            <span className="text-[var(--color-fg-muted)]">{a.label}</span>
            <span className="font-[var(--font-mono)] text-[var(--color-fg-subtle)] tabular-nums">
              {(a.fraction * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
