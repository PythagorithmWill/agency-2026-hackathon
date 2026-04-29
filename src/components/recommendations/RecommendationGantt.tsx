import Link from "next/link";
import type { Recommendation } from "@/lib/recommendations/build";

/**
 * Capital-planning Gantt timeline for the recommendations roadmap.
 * Pure SVG so it renders server-side with no JS, no animation, no
 * race against the React 19 + Turbopack reconciler. Bars are coloured
 * by priority; dependency arrows render as quadratic curves between
 * the predecessor's end and the dependent's start.
 *
 * The X-axis is months from "today". Recommendations sort top-to-bottom
 * by start offset so the eye traces left-to-right and top-to-bottom in
 * priority order.
 */

const PRIORITY_COLORS = {
  now: "var(--color-accent-fail)",
  next_quarter: "var(--color-accent-warn)",
  next_cycle: "var(--color-fg-muted)",
} as const;

const ROW_HEIGHT = 36;
const BAR_HEIGHT = 18;
const LABEL_WIDTH = 240;
const RIGHT_PAD = 24;
const TOP_PAD = 48;
const BOTTOM_PAD = 24;
const MAX_DAYS = 540; // ~18 months

export function RecommendationGantt({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const sorted = [...recommendations].sort((a, b) => {
    const t = a.timeline.startOffsetDays - b.timeline.startOffsetDays;
    if (t !== 0) return t;
    return a.timeline.durationDays - b.timeline.durationDays;
  });

  // Compute the max horizon so the chart auto-extends if any rec runs long.
  const horizon = Math.max(
    MAX_DAYS,
    ...sorted.map((r) => r.timeline.startOffsetDays + r.timeline.durationDays + 30),
  );

  const innerWidth = 880; // SVG drawing width
  const totalWidth = LABEL_WIDTH + innerWidth + RIGHT_PAD;
  const totalHeight = TOP_PAD + sorted.length * ROW_HEIGHT + BOTTOM_PAD;

  function xForDay(d: number): number {
    return LABEL_WIDTH + (d / horizon) * innerWidth;
  }

  // Build a quick id → row index map for dependency arrows.
  const indexById = new Map<string, number>();
  sorted.forEach((r, i) => indexById.set(r.id, i));

  // Month tick marks every 3 months.
  const monthTicks: Array<{ day: number; label: string }> = [];
  for (let m = 0; m <= horizon / 30; m += 3) {
    monthTicks.push({
      day: m * 30,
      label: m === 0 ? "Today" : `+${m}m`,
    });
  }

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 overflow-hidden">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-3">
        <h3 className="text-[15px] tracking-tight">Capital-planning timeline</h3>
        <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          {sorted.length} recommendations · horizon {Math.round(horizon / 30)} months
        </div>
      </div>
      <p className="text-[13.5px] text-[var(--color-fg-muted)] leading-[1.6] mb-5 max-w-[760px]">
        Each bar shows the recommended start offset and duration; arrows mark
        explicit dependencies (do X before Y). Click any bar for the full
        recommendation detail.
      </p>
      <div className="overflow-x-auto -mx-2 px-2">
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
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
            </marker>
          </defs>

          {/* Month grid + axis labels */}
          {monthTicks.map((t) => (
            <g key={`tick-${t.day}`}>
              <line
                x1={xForDay(t.day)}
                x2={xForDay(t.day)}
                y1={TOP_PAD - 16}
                y2={totalHeight - BOTTOM_PAD}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray={t.day === 0 ? "" : "2 4"}
              />
              <text
                x={xForDay(t.day)}
                y={TOP_PAD - 22}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--color-fg-subtle)"
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Rows */}
          {sorted.map((r, i) => {
            const y = TOP_PAD + i * ROW_HEIGHT;
            const startX = xForDay(r.timeline.startOffsetDays);
            const endX = xForDay(r.timeline.startOffsetDays + r.timeline.durationDays);
            const w = Math.max(2, endX - startX);
            const color = PRIORITY_COLORS[r.priority];
            return (
              <g key={r.id}>
                {/* Row label (rec title, truncated) */}
                <text
                  x={LABEL_WIDTH - 12}
                  y={y + BAR_HEIGHT / 2 + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--color-fg)"
                >
                  {r.title.length > 40 ? r.title.slice(0, 38) + "…" : r.title}
                </text>
                {/* Bar */}
                <a href={`/recommendations/${encodeURIComponent(r.id)}`}>
                  <rect
                    x={startX}
                    y={y}
                    width={w}
                    height={BAR_HEIGHT}
                    rx={4}
                    fill={color}
                    fillOpacity={0.18}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  {/* Milestone tick marks inside the bar */}
                  {r.timeline.milestones.map((m, mi) => {
                    const mx = xForDay(r.timeline.startOffsetDays + m.offsetDays);
                    if (mx < startX || mx > endX) return null;
                    return (
                      <circle
                        key={`m${i}-${mi}`}
                        cx={mx}
                        cy={y + BAR_HEIGHT / 2}
                        r={2.5}
                        fill={color}
                      />
                    );
                  })}
                  {/* Dollars at stake on the right of the bar */}
                  <text
                    x={endX + 6}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-fg-subtle)"
                    style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    {compactDollar(r.dollarsAtStake)}
                  </text>
                </a>
              </g>
            );
          })}

          {/* Dependency arrows */}
          {sorted.map((r, i) => {
            const yTo = TOP_PAD + i * ROW_HEIGHT + BAR_HEIGHT / 2;
            const xTo = xForDay(r.timeline.startOffsetDays);
            return r.dependsOn.map((depId) => {
              const fromIdx = indexById.get(depId);
              if (fromIdx === undefined) return null;
              const dep = sorted[fromIdx];
              const yFrom = TOP_PAD + fromIdx * ROW_HEIGHT + BAR_HEIGHT / 2;
              const xFrom = xForDay(
                dep.timeline.startOffsetDays + dep.timeline.durationDays,
              );
              const midX = (xFrom + xTo) / 2;
              const path = `M ${xFrom} ${yFrom} C ${midX} ${yFrom}, ${midX} ${yTo}, ${xTo - 4} ${yTo}`;
              return (
                <path
                  key={`dep-${depId}-${r.id}`}
                  d={path}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={1.25}
                  strokeOpacity={0.55}
                  markerEnd="url(#arrowHead)"
                />
              );
            });
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-[var(--font-mono)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        <LegendDot color={PRIORITY_COLORS.now} label="Now" />
        <LegendDot color={PRIORITY_COLORS.next_quarter} label="Next quarter" />
        <LegendDot color={PRIORITY_COLORS.next_cycle} label="Next cycle" />
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

function compactDollar(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
