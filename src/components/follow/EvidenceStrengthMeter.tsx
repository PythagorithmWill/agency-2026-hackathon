/**
 * Evidence-strength meter — a 0–1 bar with a calibrated word label.
 *
 *   < 0.40  weak      (muted)
 *   < 0.70  moderate  (amber)
 *   ≥ 0.70  strong    (accent)
 *
 * Strength is *how much of the published record supports the match*
 * (volume, recency, corroborating rows), not how severe the pattern is.
 * See docs/METHODOLOGY-V2.md and src/lib/patterns/strength.ts.
 */

export type StrengthBand = "weak" | "moderate" | "strong";

export function strengthBand(v: number): StrengthBand {
  if (v < 0.4) return "weak";
  if (v < 0.7) return "moderate";
  return "strong";
}

const BAND_COLOR: Record<StrengthBand, string> = {
  weak: "var(--color-fg-subtle)",
  moderate: "var(--color-accent-warn)",
  strong: "var(--color-accent)",
};

export function EvidenceStrengthMeter({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const band = strengthBand(v);
  const color = BAND_COLOR[band];
  return (
    <div
      className="flex items-center gap-3"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(v.toFixed(2))}
      aria-label={`Evidence strength ${v.toFixed(2)} (${band})`}
    >
      {!compact && (
        <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)] whitespace-nowrap">
          Evidence strength
        </span>
      )}
      <div
        className="h-[6px] w-[96px] rounded-full overflow-hidden bg-[var(--color-bg-elev-2)] shrink-0"
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${(v * 100).toFixed(0)}%`, background: color }}
        />
      </div>
      <span
        className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] tabular-nums whitespace-nowrap"
        style={{ color }}
      >
        {v.toFixed(2)} · {band}
      </span>
    </div>
  );
}
