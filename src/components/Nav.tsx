import Link from "next/link";

/**
 * Three-route navigation. Editorial: small caps metadata label, no logo,
 * no "AI" branding, no Pythagorithm logo. The Proof Methodology shows up
 * as a primitive in the corner of every surface (ProofBadge), never as a logo.
 */
export function Nav() {
  return (
    <nav className="border-b border-[var(--color-rule)] no-print">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
        <Link
          href="/"
          className="font-[var(--font-display)] text-[1.125rem] tracking-[var(--tracking-tight)] text-[var(--color-paper)]"
        >
          Agency 2026
        </Link>
        <div className="flex items-center gap-8 font-[var(--font-sans)] text-[var(--text-small)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          <Link href="/" className="hover:text-[var(--color-paper)]">
            Glass Box
          </Link>
          <Link href="/outcome" className="hover:text-[var(--color-paper)]">
            Outcome Brief
          </Link>
          <Link href="/counterfactual" className="hover:text-[var(--color-paper)]">
            Counterfactual Brief
          </Link>
        </div>
        <div className="text-[var(--text-micro)] font-[var(--font-mono)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          v0.1 · Build {process.env.BUILD_COMMIT?.slice(0, 7) ?? "dev"}
        </div>
      </div>
    </nav>
  );
}
