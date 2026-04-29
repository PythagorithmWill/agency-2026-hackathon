import type { PatternStatus } from "@/lib/patterns/registry";

const STYLES: Record<PatternStatus, { dot: string; text: string; label: string }> = {
  live: {
    dot: "bg-[var(--color-accent)]",
    text: "text-[var(--color-accent)]",
    label: "Live",
  },
  beta: {
    dot: "bg-[var(--color-accent-warn)]",
    text: "text-[var(--color-accent-warn)]",
    label: "Beta",
  },
  coming: {
    dot: "bg-[var(--color-fg-subtle)]",
    text: "text-[var(--color-fg-subtle)]",
    label: "Coming",
  },
};

export function PatternStatusPill({ status }: { status: PatternStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] ${s.text}`}>
      <span className={`block h-[6px] w-[6px] rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
