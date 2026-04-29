import Link from "next/link";
import type { Recommendation } from "@/lib/recommendations/build";

/**
 * Capital-planning Gantt timeline. Pure SVG, server-rendered — no JS,
 * no animation race against the React 19 + Turbopack reconciler.
 *
 * Visual layers (bottom to top):
 *   1. Month grid + today marker
 *   2. Phase-band rectangles inside each bar (3 milestones = 4 phases)
 *   3. Severity accent strip on the left edge of every bar
 *   4. Bar fill (priority colour, alpha 0.18) + outline
 *   5. Milestone tick + label
 *   6. Dependency curves with arrowheads, dashed when overlap is present
 *
 * Bar start dates have already been cascaded by buildRecommendations()
 * so dependents render to the right of their predecessors.
 */

const PRIORITY_COLORS = {
  now: "var(--color-accent-fail)",
  next_quarter: "var(--color-accent-warn)",
  next_cycle: "var(--color-fg-muted)",
} as const;

const SEVERITY_COLORS = {
  flag: "var(--color-accent-fail)",
  attention: "var(--color-accent-warn)",
  observation: "var(--color-fg-muted)",
} as const;

const ROW_HEIGHT = 64;
const BAR_HEIGHT = 30;
const LABEL_WIDTH = 280;
const RIGHT_PAD = 96;
const TOP_PAD = 64;
const BOTTOM_PAD = 56;
const MIN_HORIZON_DAYS = 540; // ~18 months

export function RecommendationGantt({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  // Bars sort top-to-bottom by start offset so dependencies cascade visually.
  // Ties break by duration (shortest first) so cleanup work doesn't visually
  // dominate the longer strategic items.
  const sorted = [...recommendations].sort((a, b) => {
    const t = a.timeline.startOffsetDays - b.timeline.startOffsetDays;
    if (t !== 0) return t;
    return a.timeline.durationDays - b.timeline.durationDays;
  });

  const horizon = Math.max(
    MIN_HORIZON_DAYS,
    ...sorted.map((r) => r.timeline.startOffsetDays + r.timeline.durationDays + 60),
  );

  const innerWidth = 880;
  const totalWidth = LABEL_WIDTH + innerWidth + RIGHT_PAD;
  const totalHeight = TOP_PAD + sorted.length * ROW_HEIGHT + BOTTOM_PAD;

  function xForDay(d: number): number {
    return LABEL_WIDTH + (d / horizon) * innerWidth;
  }

  const indexById = new Map<string, number>();
  sorted.forEach((r, i) => indexById.set(r.id, i));

  const monthTicks: Array<{ day: number; label: string; isQuarter: boolean }> = [];
  for (let m = 0; m <= horizon / 30; m++) {
    monthTicks.push({
      day: m * 30,
      label: m === 0 ? "Today" : `+${m}m`,
      isQuarter: m % 3 === 0,
    });
  }

  if (sorted.length === 0) return null;

  // Pre-compute summary stats for the chart ribbon.
  const totalDays = horizon;
  const totalDollars = sorted.reduce((s, r) => s + r.dollarsAtStake, 0);
  const longest = Math.max(...sorted.map((r) => r.timeline.durationDays));
  const depEdges = sorted.reduce((s, r) => s + r.dependsOn.length, 0);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] overflow-hidden">
      {/* Header strip */}
      <div className="border-b border-[var(--color-border)] px-6 py-5 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[18px] tracking-tight">Capital-planning timeline</h3>
          <p className="mt-1 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Sequenced execution map · dependency-cascaded · not policy advice
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-[var(--font-mono)] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
          <Stat label="Recommendations" value={sorted.length.toLocaleString("en-CA")} />
          <Stat label="Horizon" value={`${Math.round(totalDays / 30)} months`} />
          <Stat label="Longest item" value={`${Math.round(longest / 30)} mo`} />
          <Stat label="Dep edges" value={depEdges.toString()} />
          <Stat label="Sequenced $" value={compactDollar(totalDollars)} />
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto px-2 pt-2">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="block"
          role="img"
          aria-label="Recommendations Gantt timeline"
        >
          <defs>
            <marker
              id="arrowHead"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
            </marker>
            <pattern
              id="phaseHatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="var(--color-bg-elev-2)"
                strokeWidth="2"
              />
            </pattern>
          </defs>

          {/* Quarter shading */}
          {monthTicks
            .filter((t) => t.isQuarter && t.day < horizon)
            .map((t, i, arr) => {
              const next = arr[i + 1] ?? { day: horizon };
              return (
                <rect
                  key={`q-${t.day}`}
                  x={xForDay(t.day)}
                  y={TOP_PAD - 24}
                  width={xForDay(next.day) - xForDay(t.day)}
                  height={totalHeight - TOP_PAD - BOTTOM_PAD + 24}
                  fill={i % 2 === 0 ? "var(--color-bg-elev-2)" : "transparent"}
                  fillOpacity={0.35}
                />
              );
            })}

          {/* Month gridlines + axis labels */}
          {monthTicks.map((t) => (
            <g key={`tick-${t.day}`}>
              <line
                x1={xForDay(t.day)}
                x2={xForDay(t.day)}
                y1={TOP_PAD - 24}
                y2={totalHeight - BOTTOM_PAD + 8}
                stroke={t.isQuarter ? "var(--color-border)" : "var(--color-border)"}
                strokeOpacity={t.isQuarter ? 1 : 0.4}
                strokeWidth={t.isQuarter ? 1.25 : 0.75}
                strokeDasharray={t.day === 0 ? "" : t.isQuarter ? "" : "2 4"}
              />
              {t.isQuarter && (
                <text
                  x={xForDay(t.day) + 4}
                  y={TOP_PAD - 30}
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                  fill="var(--color-fg-subtle)"
                  style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  {t.label}
                </text>
              )}
            </g>
          ))}

          {/* "Today" emphasis line */}
          <g>
            <line
              x1={xForDay(0)}
              x2={xForDay(0)}
              y1={TOP_PAD - 30}
              y2={totalHeight - BOTTOM_PAD + 8}
              stroke="var(--color-accent)"
              strokeWidth={1.5}
            />
            <text
              x={xForDay(0) + 6}
              y={TOP_PAD - 36}
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill="var(--color-accent)"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              Today
            </text>
          </g>

          {/* Rows */}
          {sorted.map((r, i) => {
            const y = TOP_PAD + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const startX = xForDay(r.timeline.startOffsetDays);
            const endX = xForDay(
              r.timeline.startOffsetDays + r.timeline.durationDays,
            );
            const w = Math.max(8, endX - startX);
            const priColor = PRIORITY_COLORS[r.priority];
            const sevColor = SEVERITY_COLORS[r.severity];

            // Phase bands: split the bar into N+1 segments at each milestone.
            const phasePoints = [
              0,
              ...r.timeline.milestones
                .map((m) => m.offsetDays)
                .filter((o) => o > 0 && o < r.timeline.durationDays)
                .sort((a, b) => a - b),
              r.timeline.durationDays,
            ];

            return (
              <g key={r.id}>
                {/* Row hover band */}
                <rect
                  x={0}
                  y={y - (ROW_HEIGHT - BAR_HEIGHT) / 2}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill={i % 2 === 0 ? "transparent" : "var(--color-bg-elev-1)"}
                  fillOpacity={0.4}
                />

                {/* Row label group */}
                <text
                  x={LABEL_WIDTH - 14}
                  y={y + BAR_HEIGHT / 2 - 2}
                  textAnchor="end"
                  fontSize="13"
                  fill="var(--color-fg)"
                >
                  {truncate(r.title, 38)}
                </text>
                <text
                  x={LABEL_WIDTH - 14}
                  y={y + BAR_HEIGHT / 2 + 13}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--color-fg-subtle)"
                  style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  {r.dependsOn.length > 0
                    ? `↳ depends on ${r.dependsOn.length} · `
                    : ""}
                  {r.priority.replace("_", " ")} · {Math.round(r.timeline.durationDays / 30)}mo
                </text>

                {/* Bar — wrapped in <a> for click-through */}
                <a href={`/recommendations/${encodeURIComponent(r.id)}`}>
                  {/* Phase band fills (alternating) */}
                  {phasePoints.slice(0, -1).map((p, pi) => {
                    const next = phasePoints[pi + 1];
                    const px = xForDay(r.timeline.startOffsetDays + p);
                    const pwidth = xForDay(r.timeline.startOffsetDays + next) - px;
                    return (
                      <rect
                        key={`phase-${i}-${pi}`}
                        x={px}
                        y={y}
                        width={pwidth}
                        height={BAR_HEIGHT}
                        fill={pi % 2 === 0 ? priColor : "url(#phaseHatch)"}
                        fillOpacity={pi % 2 === 0 ? 0.12 : 1}
                      />
                    );
                  })}
                  {/* Bar outline */}
                  <rect
                    x={startX}
                    y={y}
                    width={w}
                    height={BAR_HEIGHT}
                    rx={5}
                    fill="none"
                    stroke={priColor}
                    strokeWidth={1.5}
                  />
                  {/* Severity accent strip on the left edge */}
                  <rect
                    x={startX}
                    y={y}
                    width={4}
                    height={BAR_HEIGHT}
                    rx={2}
                    fill={sevColor}
                  />
                  {/* Milestone ticks with labels */}
                  {r.timeline.milestones.map((m, mi) => {
                    const mx = xForDay(r.timeline.startOffsetDays + m.offsetDays);
                    if (mx < startX || mx > endX) return null;
                    return (
                      <g key={`m${i}-${mi}`}>
                        <line
                          x1={mx}
                          x2={mx}
                          y1={y + 3}
                          y2={y + BAR_HEIGHT - 3}
                          stroke={priColor}
                          strokeWidth={1.5}
                          strokeOpacity={0.85}
                        />
                        <circle
                          cx={mx}
                          cy={y + BAR_HEIGHT + 8}
                          r={2.5}
                          fill={priColor}
                        />
                      </g>
                    );
                  })}
                  {/* Dollars at stake on the right */}
                  <text
                    x={endX + 8}
                    y={y + BAR_HEIGHT / 2 - 2}
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-fg)"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    {compactDollar(r.dollarsAtStake)}
                  </text>
                  <text
                    x={endX + 8}
                    y={y + BAR_HEIGHT / 2 + 12}
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-fg-subtle)"
                    style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    conf {(r.confidence.score * 100).toFixed(0)}%
                  </text>
                </a>
              </g>
            );
          })}

          {/* Dependency arrows — drawn LAST so they sit on top of bars. */}
          {sorted.map((r, i) => {
            const yTo = TOP_PAD + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2 + BAR_HEIGHT / 2;
            const xTo = xForDay(r.timeline.startOffsetDays);
            return r.dependsOn.map((depId) => {
              const fromIdx = indexById.get(depId);
              if (fromIdx === undefined) return null;
              const dep = sorted[fromIdx];
              const yFrom =
                TOP_PAD + fromIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2 + BAR_HEIGHT / 2;
              const xFrom = xForDay(
                dep.timeline.startOffsetDays + dep.timeline.durationDays,
              );
              const overlap = xFrom > xTo;
              const midX = overlap
                ? Math.max(xFrom, xTo) + 30
                : (xFrom + xTo) / 2;
              const path = overlap
                ? `M ${xFrom} ${yFrom} C ${midX} ${yFrom}, ${midX} ${yTo}, ${xTo - 6} ${yTo}`
                : `M ${xFrom} ${yFrom} C ${midX} ${yFrom}, ${midX} ${yTo}, ${xTo - 6} ${yTo}`;
              return (
                <path
                  key={`dep-${depId}-${r.id}`}
                  d={path}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={1.75}
                  strokeOpacity={0.7}
                  strokeDasharray={overlap ? "4 4" : ""}
                  markerEnd="url(#arrowHead)"
                />
              );
            });
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="border-t border-[var(--color-border)] px-6 py-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-[11px] font-[var(--font-mono)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        <LegendDot color={PRIORITY_COLORS.now} label="Priority · now" />
        <LegendDot color={PRIORITY_COLORS.next_quarter} label="Priority · next quarter" />
        <LegendDot color={PRIORITY_COLORS.next_cycle} label="Priority · next cycle" />
        <span className="opacity-50">·</span>
        <LegendBar color={SEVERITY_COLORS.flag} label="Severity edge: flag" />
        <LegendBar color={SEVERITY_COLORS.attention} label="attention" />
        <LegendBar color={SEVERITY_COLORS.observation} label="observation" />
        <span className="opacity-50">·</span>
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" aria-hidden>
            <line x1="0" y1="5" x2="22" y2="5" stroke="var(--color-accent)" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
          </svg>
          Dependency edge
        </span>
        <span className="ml-auto">
          <Link
            href={"/methodology" as never}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            How is the timeline computed? →
          </Link>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="opacity-70">{label}</span>
      <span className="text-[var(--color-fg)] tabular-nums">{value}</span>
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function LegendBar({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-1 h-3 rounded-sm"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function truncate(s: string, max = 48): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function compactDollar(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
