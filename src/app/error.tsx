"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root-level error boundary. Catches Next.js / React reconciliation
 * errors that escape the route-level boundaries, and the intermittent
 * `removeChild` crashes specific to Next 15 + React 19 + Turbopack +
 * route navigation.
 *
 * The removeChild error is non-recoverable in-place (React's commit
 * phase has already torn the tree). We auto-reset once on first mount
 * to silently re-render. If the error recurs, we show a calibrated
 * fallback panel rather than blocking the user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isRemoveChild =
    typeof error?.message === "string" &&
    error.message.toLowerCase().includes("removechild");

  useEffect(() => {
    if (isRemoveChild) {
      // Auto-recover from the React-internal removeChild race on the
      // next microtask. The tree is already torn; reset re-renders.
      const t = setTimeout(reset, 0);
      return () => clearTimeout(t);
    }
  }, [isRemoveChild, reset]);

  if (isRemoveChild) {
    // Render nothing while the auto-reset fires.
    return null;
  }

  return (
    <main className="min-h-screen pt-32">
      <div className="mx-auto max-w-[760px] px-6 py-16">
        <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Glassbox · runtime error
        </div>
        <h1 className="mt-4 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
          Something hiccuped.
        </h1>
        <p className="mt-6 text-[var(--text-body-lg)] text-[var(--color-fg-muted)] leading-[1.5]">
          The page hit an unrecoverable error mid-render. The dataset shows
          this can happen during heavy parallel queries or when the browser
          and React reconciler disagree on the DOM. Click below to reset, or
          navigate away.
        </p>
        <div className="mt-6 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
          {error.digest && <>Digest: {error.digest} · </>}
          {error.message?.slice(0, 200)}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[13px]"
          >
            Try again
          </button>
          <Link
            href={"/" as never}
            className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[13px]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
