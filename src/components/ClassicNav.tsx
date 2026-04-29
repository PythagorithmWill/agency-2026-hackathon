import Link from "next/link";

/**
 * Classic-edition navigation. Top strip is the small-caps "VIEWING CLASSIC
 * EDITION" indicator with a return-to-Manifold link. Below: the three
 * surface routes plus the build identity.
 */
export function ClassicNav() {
  return (
    <>
      <div className="border-b border-[var(--color-rule)] bg-[var(--color-vellum)] no-print">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-between px-8 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          <span>Viewing Classic Edition</span>
          <Link
            href={"/" as never}
            className="hover:text-[var(--color-paper)]"
          >
            ← Manifold
          </Link>
        </div>
      </div>
      <nav className="border-b border-[var(--color-rule)] no-print">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
          <Link
            href={"/classic" as never}
            className="font-[var(--font-display)] text-[1.125rem] tracking-[var(--tracking-tight)] text-[var(--color-paper)]"
          >
            Agency 2026 — Classic
          </Link>
          <div className="flex items-center gap-8 font-[var(--font-sans)] text-[var(--text-small)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            <Link
              href={"/classic" as never}
              className="hover:text-[var(--color-paper)]"
            >
              Glass Box
            </Link>
            <Link
              href={"/classic/outcome" as never}
              className="hover:text-[var(--color-paper)]"
            >
              Outcome Brief
            </Link>
            <Link
              href={"/classic/counterfactual" as never}
              className="hover:text-[var(--color-paper)]"
            >
              Counterfactual Brief
            </Link>
          </div>
          <div className="text-[var(--text-micro)] font-[var(--font-mono)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            v0.2 · Build {process.env.BUILD_COMMIT?.slice(0, 7) ?? "dev"}
          </div>
        </div>
      </nav>
    </>
  );
}
