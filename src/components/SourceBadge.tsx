import type { DatasetSource } from "@/lib/types";

const STYLE: Record<
  DatasetSource,
  { label: string; color: string; bg: string; border: string }
> = {
  fed: {
    label: "FED",
    color: "var(--color-accent)",
    bg: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
    border: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
  },
  ab_grants: {
    label: "AB · GRANT",
    color: "#F5C36F",
    bg: "rgba(245, 195, 111, 0.10)",
    border: "rgba(245, 195, 111, 0.35)",
  },
  ab_contracts: {
    label: "AB · CONTRACT",
    color: "#E8704F",
    bg: "rgba(232, 112, 79, 0.10)",
    border: "rgba(232, 112, 79, 0.35)",
  },
  general: {
    label: "REGISTRY",
    color: "var(--color-fg-subtle)",
    bg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.08)",
  },
};

/**
 * Source pill — sub-1rem chip used on every retrieved record card so the
 * dataset of origin is legible at a glance.
 */
export function SourceBadge({
  source,
  className,
}: {
  source: DatasetSource;
  className?: string;
}) {
  const s = STYLE[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] ${className ?? ""}`}
      style={{
        color: s.color,
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

export function getSourceLabel(source: DatasetSource): string {
  switch (source) {
    case "fed":
      return "Federal grants & contributions";
    case "ab_grants":
      return "Alberta provincial grants";
    case "ab_contracts":
      return "Alberta provincial contracts";
    default:
      return "Registry";
  }
}
