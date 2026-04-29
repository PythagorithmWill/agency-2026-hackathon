"use client";

import Link from "next/link";

/**
 * Recipient route error boundary. The federal-corpus query and
 * golden-record fallback can both fail under DB contention; rather
 * than blowing up to a 500, render a calibrated "limited info"
 * panel so the user can navigate away.
 */
export default function RecipientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen pt-32">
      <div className="mx-auto max-w-[760px] px-6 py-16">
        <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Glassbox · recipient profile
        </div>
        <h1 className="mt-4 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
          Profile unavailable.
        </h1>
        <p className="mt-6 text-[var(--text-body-lg)] text-[var(--color-fg-muted)] leading-[1.5]">
          The dataset query for this recipient timed out or returned an
          unexpected shape. This usually means the recipient appears under
          many name variants in the corpus, or the database connection pool
          is contended by parallel detector runs. Try again in a moment, or
          search for a more specific identifier.
        </p>

        <div className="mt-6 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
          {error.digest && <>Digest: {error.digest} · </>}
          Click below to retry.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[13px]"
          >
            Try again
          </button>
          <Link
            href={"/transparency/recipients" as never}
            className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[13px]"
          >
            All recipients
          </Link>
          <Link
            href={"/follow" as never}
            className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[13px]"
          >
            Pattern catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
