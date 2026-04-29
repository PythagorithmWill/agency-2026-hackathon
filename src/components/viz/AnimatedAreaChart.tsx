"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Historical {
  fy: number;
  value: number;
}

interface Forecast {
  fy: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

interface Props {
  historical: ReadonlyArray<Historical>;
  forecast?: ReadonlyArray<Forecast>;
  width?: number;
  height?: number;
  color?: string;
  showLegend?: boolean;
}

/**
 * Historical line + forecast envelope. Forecast band is the
 * lowerBound..upperBound polygon at 25% opacity; predicted line dashed.
 */
export function AnimatedAreaChart({
  historical,
  forecast = [],
  width = 720,
  height = 240,
  color = "var(--color-accent)",
  showLegend = true,
}: Props) {
  const reduce = useReducedMotion();

  const allXs = [
    ...historical.map((p) => p.fy),
    ...forecast.map((p) => p.fy),
  ];
  const allYs = [
    ...historical.map((p) => p.value),
    ...forecast.flatMap((p) => [p.lowerBound, p.upperBound, p.predicted]),
  ];

  if (allXs.length < 2) {
    return (
      <div className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)] py-8">
        Insufficient series for forecasting.
      </div>
    );
  }

  const padL = 56;
  const padR = 16;
  const padT = 14;
  const padB = 32;
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const minY = 0;
  const maxY = Math.max(...allYs, 1);

  const xScale = (x: number) =>
    padL + ((x - minX) / Math.max(1, maxX - minX)) * (width - padL - padR);
  const yScale = (y: number) =>
    height - padB - ((y - minY) / Math.max(1, maxY - minY)) * (height - padT - padB);

  const histPath = historical
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.fy).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
    .join(" ");

  // Forecast polygon: upperBound forward + lowerBound backward.
  // Anchor it to the last historical point so the band visually starts
  // at the forecast handoff rather than floating in mid-air.
  const handoff = historical[historical.length - 1];
  const upper = forecast
    .map((p) => `${xScale(p.fy).toFixed(1)},${yScale(p.upperBound).toFixed(1)}`)
    .join(" ");
  const lower = [...forecast]
    .reverse()
    .map((p) => `${xScale(p.fy).toFixed(1)},${yScale(p.lowerBound).toFixed(1)}`)
    .join(" ");
  const bandPoints = forecast.length
    ? `${xScale(handoff.fy)},${yScale(handoff.value)} ${upper} ${lower} ${xScale(handoff.fy)},${yScale(handoff.value)}`
    : "";

  const forecastPath = forecast.length
    ? `M ${xScale(handoff.fy).toFixed(1)} ${yScale(handoff.value).toFixed(1)} ` +
      forecast
        .map((p) => `L ${xScale(p.fy).toFixed(1)} ${yScale(p.predicted).toFixed(1)}`)
        .join(" ")
    : "";

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const dollar = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* y-grid */}
        {yTicks.map((v, i) => (
          <g key={`yg-${i}`}>
            <line
              x1={padL}
              y1={yScale(v)}
              x2={width - padR}
              y2={yScale(v)}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? "" : "2 4"}
            />
            <text
              x={padL - 8}
              y={yScale(v) + 4}
              textAnchor="end"
              className="fill-[var(--color-fg-subtle)]"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {dollar(v)}
            </text>
          </g>
        ))}
        {/* x-axis labels (years) */}
        {[minX, Math.round((minX + maxX) / 2), maxX].map((fy, i) => (
          <text
            key={`xl-${i}`}
            x={xScale(fy)}
            y={height - padB + 16}
            textAnchor="middle"
            className="fill-[var(--color-fg-subtle)]"
            style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          >
            FY{fy}
          </text>
        ))}

        {/* forecast band */}
        {bandPoints && (
          <motion.polygon
            points={bandPoints}
            fill={color}
            opacity={0.18}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 0.18 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          />
        )}
        {/* historical line */}
        <motion.path
          d={histPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* forecast line dashed */}
        {forecastPath && (
          <motion.path
            d={forecastPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.0, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {/* historical points */}
        {historical.map((p, i) => (
          <circle
            key={`hp-${i}`}
            cx={xScale(p.fy)}
            cy={yScale(p.value)}
            r={2.5}
            fill={color}
          />
        ))}
        {/* handoff marker */}
        {forecast.length > 0 && (
          <line
            x1={xScale(handoff.fy)}
            y1={padT}
            x2={xScale(handoff.fy)}
            y2={height - padB}
            stroke="var(--color-border-strong)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        )}
      </svg>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
          <span className="flex items-center gap-2">
            <span className="block h-[2px] w-4" style={{ background: color }} /> historical
          </span>
          {forecast.length > 0 && (
            <>
              <span className="flex items-center gap-2">
                <span
                  className="block h-[2px] w-4"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 8px)`,
                  }}
                />
                forecast
              </span>
              <span className="flex items-center gap-2">
                <span className="block h-2 w-4" style={{ background: color, opacity: 0.18 }} />
                ±1.96σ band
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
