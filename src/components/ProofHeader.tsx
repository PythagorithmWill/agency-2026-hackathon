import Link from "next/link";

/**
 * Minimal header used on /proof routes. /proof pages live at root and are
 * reachable from both the Manifold and Classic edition, so the header is
 * non-prescriptive: small-caps metadata label plus a subtle "back to
 * Manifold" / "Classic view" pair.
 */
export function ProofHeader() {
  return (
    <header className="border-b border-[var(--color-rule)] no-print">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-8 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[0.12em] text-[var(--color-muted)]">
        <span>Pythagorithm Proof</span>
        <div className="flex items-center gap-6">
          <Link
            href={"/" as never}
            className="hover:text-[var(--color-paper)]"
          >
            Manifold ↗
          </Link>
          <Link
            href={"/classic" as never}
            className="hover:text-[var(--color-paper)]"
          >
            Classic ↗
          </Link>
        </div>
      </div>
    </header>
  );
}
