"use client";

import { useMemo } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { AmendmentEvent } from "@/lib/evaluate/retrieval";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/**
 * Defensive date formatter — pg returns DATE columns as JS Date instances
 * by default, but the AmendmentEvent type declares date as string. Coerce
 * before slicing so a Date doesn't crash the render with
 * "date.slice is not a function".
 */
function formatDate(d: unknown): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  try {
    return new Date(d as string | number).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/**
 * Horizontal amendment-chain timeline. Notches plot left-to-right on
 * viewport entry; line height = dollar value at that amendment. Hover
 * a notch to see the date + delta from previous amendment + description
 * excerpt if available.
 */
export function AmendmentTimeline({ events }: { events: AmendmentEvent[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const data = useMemo(() => {
    if (events.length === 0) return null;
    const maxValue = Math.max(...events.map((e) => e.agreementValue), 1);
    const dates = events
      .map((e) => (e.date ? new Date(e.date).getTime() : null))
      .filter((d): d is number => d !== null);
    const minDate = dates.length > 0 ? Math.min(...dates) : Date.now();
    const maxDate = dates.length > 0 ? Math.max(...dates) : Date.now();
    const dateSpan = Math.max(1, maxDate - minDate);

    const w = 1000;
    const h = 220;
    const margin = { top: 24, right: 32, bottom: 40, left: 56 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const points = events.map((e, i) => {
      const t = e.date ? new Date(e.date).getTime() : minDate;
      const x = margin.left + ((t - minDate) / dateSpan) * innerW;
      const y =
        margin.top +
        innerH -
        (Math.max(0, e.agreementValue) / maxValue) * innerH;
      return { ...e, x, y, i };
    });

    return { points, w, h, margin, innerW, innerH, maxValue, minDate, maxDate };
  }, [events]);

  if (!data) {
    return (
      <div className="text-[14px] text-[var(--color-fg-muted)] italic">
        No amendment chain available for this record.
      </div>
    );
  }

  const { points, w, h, margin, innerW, innerH, maxValue } = data;
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        aria-label={`Amendment chain — ${events.length} entries`}
      >
        {/* Axes */}
        <line
          x1={margin.left}
          y1={margin.top + innerH}
          x2={w - margin.right}
          y2={margin.top + innerH}
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerH}
          stroke="var(--color-border)"
          strokeWidth="1"
        />

        {/* Y-axis amount label */}
        <text
          x={margin.left}
          y={margin.top - 8}
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="var(--color-fg-subtle)"
          letterSpacing="0.08em"
        >
          {cad.format(maxValue)}
        </text>
        <text
          x={margin.left}
          y={margin.top + innerH + 16}
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="var(--color-fg-subtle)"
          letterSpacing="0.08em"
        >
          $0
        </text>

        {/* Line connecting amendments */}
        <motion.path
          d={lineD}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={inView && !reduce ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />

        {/* Notches */}
        {points.map((p, i) => (
          <g key={p.i} className="cursor-help">
            <title>
              {`Amendment ${p.amendmentNumber}${p.date ? ` · ${formatDate(p.date)}` : ""} · ${cad.format(p.agreementValue)}`}
            </title>
            {/* drop line */}
            <motion.line
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={margin.top + innerH}
              stroke="var(--color-accent)"
              strokeWidth="1"
              opacity="0.25"
              initial={{ pathLength: 0 }}
              animate={inView && !reduce ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{
                delay: reduce ? 0 : 0.4 + i * 0.06,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={4.5}
              fill="var(--color-bg)"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={inView && !reduce ? { scale: 1 } : reduce ? { scale: 1 } : { scale: 0 }}
              transition={{
                delay: reduce ? 0 : 0.4 + i * 0.06,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
          </g>
        ))}
      </svg>

      {/* Below-chart legend: list of amendments */}
      <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 font-[var(--font-mono)] text-[12px]">
        {points.map((p) => {
          const prev = points[p.i - 1];
          const delta = prev ? p.agreementValue - prev.agreementValue : 0;
          return (
            <li key={p.i} className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--color-fg-muted)]">
                #{p.amendmentNumber}
                {p.date && (
                  <span className="ml-2 text-[var(--color-fg-subtle)]">
                    {formatDate(p.date)}
                  </span>
                )}
              </span>
              <span className="text-right">
                <span className="text-[var(--color-fg)]">{cad.format(p.agreementValue)}</span>
                {prev && delta !== 0 && (
                  <span
                    className="ml-2"
                    style={{
                      color:
                        delta > 0
                          ? "var(--color-accent-warm, #F5C36F)"
                          : "var(--color-accent)",
                    }}
                  >
                    {delta > 0 ? "+" : ""}
                    {cad.format(delta)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
