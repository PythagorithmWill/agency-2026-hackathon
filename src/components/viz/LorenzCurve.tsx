"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Props {
  decileBreakdown: ReadonlyArray<{ decile: number; share: number }>;
  gini: number;
  width?: number;
  height?: number;
}

/**
 * Lorenz curve from a decile breakdown. Plots cumulative-share vs.
 * cumulative-population. The 45° equality line is drawn as the
 * reference. The area between the curves IS the Gini coefficient.
 */
export function LorenzCurve({
  decileBreakdown,
  gini,
  width = 320,
  height = 240,
}: Props) {
  const reduce = useReducedMotion();
  const padL = 40;
  const padR = 12;
  const padT = 14;
  const padB = 36;

  // Cumulative shares (start at 0,0)
  const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let cum = 0;
  decileBreakdown.forEach((d) => {
    cum += d.share;
    points.push({ x: d.decile / 10, y: cum });
  });

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xScale = (v: number) => padL + v * innerW;
  const yScale = (v: number) => height - padB - v * innerH;

  const lorenzPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* equality reference */}
        <line
          x1={xScale(0)}
          y1={yScale(0)}
          x2={xScale(1)}
          y2={yScale(1)}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* axes */}
        <line
          x1={xScale(0)}
          y1={yScale(0)}
          x2={xScale(1)}
          y2={yScale(0)}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <line
          x1={xScale(0)}
          y1={yScale(0)}
          x2={xScale(0)}
          y2={yScale(1)}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        {/* axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={`tx-${v}`}>
            <text
              x={xScale(v)}
              y={height - padB + 14}
              textAnchor="middle"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-fg-subtle)" }}
            >
              {(v * 100).toFixed(0)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={`ty-${v}`}>
            <text
              x={padL - 6}
              y={yScale(v) + 3}
              textAnchor="end"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-fg-subtle)" }}
            >
              {(v * 100).toFixed(0)}
            </text>
          </g>
        ))}
        {/* lorenz */}
        <motion.path
          d={lorenzPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* axis labels */}
        <text
          x={padL + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-fg-muted)" }}
        >
          % of recipients (sorted ascending)
        </text>
        <text
          x={-(padT + innerH / 2)}
          y={12}
          transform="rotate(-90)"
          textAnchor="middle"
          style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-fg-muted)" }}
        >
          % of total spend
        </text>
        <text
          x={width - padR}
          y={padT + 12}
          textAnchor="end"
          style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-accent)" }}
        >
          Gini = {gini.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
