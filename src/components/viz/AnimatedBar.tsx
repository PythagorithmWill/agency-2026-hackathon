"use client";

import { motion, useReducedMotion } from "framer-motion";

export type ValueFormat = "currency-compact" | "currency-full" | "number" | "percent";

interface Row {
  label: string;
  value: number;
  /** Optional pre-formatted value string. Wins over `format`. Server components
   *  should pre-format complex values themselves and pass this. */
  valueLabel?: string;
  /** Optional secondary line below the label (e.g., a count or share). */
  sublabel?: string;
  /** Optional href — wraps the row in an anchor. */
  href?: string;
}

interface Props {
  rows: ReadonlyArray<Row>;
  /** Built-in format key. Default: currency-compact ($1.5B / $400M / $25K). */
  format?: ValueFormat;
  /** Maximum bar value. Defaults to max(rows.value). */
  max?: number;
  /** Bar fill color. Defaults to --color-accent. */
  color?: string;
  /** Number of rows to render. Defaults to all. */
  limit?: number;
  className?: string;
}

const FORMATTERS: Record<ValueFormat, (n: number) => string> = {
  "currency-compact": (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  },
  "currency-full": (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n),
  number: (n) => Math.round(n).toLocaleString("en-CA"),
  percent: (n) => `${(n * 100).toFixed(1)}%`,
};

/**
 * Horizontal-bar list. Used for top-N recipients/departments/programs.
 * Bars animate in width on first paint via framer-motion. Reduced-motion
 * honored — bars appear at full width instantly.
 *
 * Format is a string key (not a function) so this client component can
 * be safely consumed by server components without crossing the function
 * serialization boundary.
 */
export function AnimatedBar({
  rows,
  format = "currency-compact",
  max,
  color = "var(--color-accent)",
  limit,
  className = "",
}: Props) {
  const reduce = useReducedMotion();
  const visible = limit ? rows.slice(0, limit) : rows;
  const peak = max ?? visible.reduce((m, r) => Math.max(m, r.value), 0);
  const fmt = FORMATTERS[format];

  return (
    <ol className={`space-y-3 ${className}`}>
      {visible.map((r, i) => {
        const pct = peak > 0 ? (r.value / peak) * 100 : 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] text-[var(--color-fg)]" title={r.label}>
                  {r.label}
                </div>
                {r.sublabel && (
                  <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
                    {r.sublabel}
                  </div>
                )}
              </div>
              <div className="font-[var(--font-mono)] text-[12px] tabular-nums text-[var(--color-fg-muted)] whitespace-nowrap">
                {r.valueLabel ?? fmt(r.value)}
              </div>
            </div>
            <div className="mt-1.5 h-[6px] rounded-full bg-[var(--color-border)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </>
        );
        return (
          <li key={`${r.label}-${i}`}>
            {r.href ? (
              <a
                href={r.href}
                className="block hover:opacity-90 transition-opacity"
              >
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
