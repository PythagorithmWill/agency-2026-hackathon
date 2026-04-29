"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Props {
  points: ReadonlyArray<{ fy: number; value: number }>;
  width?: number;
  height?: number;
  color?: string;
  showAxis?: boolean;
}

/**
 * Compact sparkline. SVG path drawn in once on mount via path-length tween.
 * No tick marks unless `showAxis` is set.
 */
export function AnimatedSparkline({
  points,
  width = 360,
  height = 80,
  color = "var(--color-accent)",
  showAxis = false,
}: Props) {
  const reduce = useReducedMotion();
  if (points.length < 2) {
    return (
      <div
        className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]"
        style={{ width, height: height / 2 }}
      >
        Insufficient series
      </div>
    );
  }

  const padX = 4;
  const padY = 6;
  const xs = points.map((p) => p.fy);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys, 1);

  const xScale = (x: number) =>
    padX + ((x - minX) / Math.max(1, maxX - minX)) * (width - padX * 2);
  const yScale = (y: number) =>
    height - padY - ((y - minY) / Math.max(1, maxY - minY)) * (height - padY * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.fy).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {showAxis && (
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.circle
        cx={xScale(last.fy)}
        cy={yScale(last.value)}
        r={3}
        fill={color}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      />
    </svg>
  );
}
