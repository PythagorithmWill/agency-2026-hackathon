"use client";

import { useState } from "react";
import type { AwardeeConcentration } from "@/lib/types";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const PALETTE = [
  "var(--color-accent)",
  "rgba(94,234,212,0.66)",
  "rgba(94,234,212,0.46)",
  "rgba(94,234,212,0.32)",
  "rgba(94,234,212,0.20)",
];

export function RecipientConcentrationBar({
  concentration,
}: {
  concentration: AwardeeConcentration;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = concentration.topRecipients.reduce((s, r) => s + r.totalAwarded, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Stacked bar */}
      <div
        className="w-full h-12 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] overflow-hidden flex"
        role="img"
        aria-label="Top-recipient share of comparable funding"
      >
        {concentration.topRecipients.map((r, i) => (
          <div
            key={r.name}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            style={{
              width: 0,
              backgroundColor: PALETTE[i] ?? "rgba(255,255,255,0.16)",
              animation: `seg-fill 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms forwards`,
              ["--target-width" as string]: `${(r.totalAwarded / total) * 100}%`,
              transition: "filter 200ms",
              filter: hover === i ? "brightness(1.2)" : "brightness(1)",
            }}
            className="cursor-help h-full first:rounded-l-[8px] last:rounded-r-[8px]"
          />
        ))}
        {/* Show remaining as "other" if present */}
        {concentration.topRecipients.length < 5 ? null : null}
      </div>
      <style>{`
        @keyframes seg-fill {
          to { width: var(--target-width); }
        }
      `}</style>

      {/* Legend */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {concentration.topRecipients.map((r, i) => (
          <li
            key={r.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={
              "flex items-baseline justify-between gap-3 transition-colors " +
              (hover === i ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]")
            }
          >
            <span className="flex items-baseline gap-3 min-w-0">
              <span
                aria-hidden
                className="h-1.5 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: PALETTE[i] ?? "rgba(255,255,255,0.16)" }}
              />
              <span className="text-[var(--text-body-sm)] truncate">{r.name}</span>
            </span>
            <span className="font-[var(--font-mono)] text-[var(--text-mono)] flex-shrink-0">
              {(r.share * 100).toFixed(0)}% · {cad.format(r.totalAwarded)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[var(--text-body)] leading-[24px] text-[var(--color-fg)]">
        {concentration.observation}
      </p>
      <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        HHI: {concentration.hhi.toFixed(3)}
      </div>
    </div>
  );
}
