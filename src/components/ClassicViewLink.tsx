import Link from "next/link";

/**
 * The persistent "Classic view" affordance — bottom-right, JetBrains Mono
 * 11px, always visible. This is the manual fallback escape hatch from the
 * Manifold experience.
 */
export function ClassicViewLink() {
  return (
    <Link
      href={"/classic" as never}
      className="fixed bottom-4 right-4 z-50 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] hover:text-[var(--color-paper)] no-print"
    >
      Classic view ↗
    </Link>
  );
}
