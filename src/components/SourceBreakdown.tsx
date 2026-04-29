import type { DatasetSource } from "@/lib/types";

const LABEL: Record<DatasetSource, string> = {
  fed: "federal grants",
  ab_grants: "AB grants",
  ab_contracts: "AB contracts",
  general: "general",
};

const COLOR: Record<DatasetSource, string> = {
  fed: "var(--color-accent)",
  ab_grants: "var(--color-accent-warm, #F5C36F)",
  ab_contracts: "var(--color-accent-warn, #E8704F)",
  general: "var(--color-fg-subtle)",
};

/**
 * "8 federal grants · 3 AB grants · 1 AB contract" row in mono caption.
 * Renders only sources with > 0 records. Each label uses a tiny coloured
 * dot drawn from the source palette so the visual hierarchy reads source
 * → count.
 */
export function SourceBreakdown({
  bySource,
  className,
}: {
  bySource: Partial<Record<DatasetSource, number>>;
  className?: string;
}) {
  const sources: DatasetSource[] = ["fed", "ab_grants", "ab_contracts"];
  const present = sources.filter((s) => (bySource[s] ?? 0) > 0);
  if (present.length === 0) return null;

  return (
    <div
      className={`inline-flex items-center flex-wrap gap-x-4 gap-y-1.5 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] ${className ?? ""}`}
    >
      <span className="text-[var(--color-fg-subtle)]">Sources:</span>
      {present.map((s, i) => {
        const n = bySource[s] ?? 0;
        const label = LABEL[s];
        const labelText = `${n} ${label}${n === 1 && label.endsWith("s") ? label.slice(0, -1) : label}`;
        // Singularize: "8 federal grants" / "1 federal grant"
        const display = n === 1
          ? `${n} ${label.replace(/s$/, "")}`
          : `${n} ${label}`;
        return (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: COLOR[s] }}
            />
            <span>{display}</span>
            {i < present.length - 1 && <span className="text-[var(--color-fg-subtle)] ml-2">·</span>}
          </span>
        );
      })}
    </div>
  );
}
