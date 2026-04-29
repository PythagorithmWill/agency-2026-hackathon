import Link from "next/link";

const TIERS = ["Input", "Context", "Output", "Audit"] as const;

/**
 * Section D — two-column layout. Left: prose explaining the audit token.
 * Right: a four-band stylized representation of the token, each band
 * with a sage check.
 *
 * No framer-motion — its whileInView observers raced with route
 * navigation away from the homepage and triggered React removeChild
 * crashes. Reveal is driven by CSS keyframes (glassbox-fade-up)
 * gated by per-band animation-delay.
 */
export function AuditTrailSection() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 md:px-16 py-32">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div style={{ animation: "glassbox-fade-up 0.6s ease-out both" }}>
          <h2 className="text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-[-0.025em] font-semibold">
            Every output carries an audit trail.
          </h2>
          <p className="mt-6 text-[18px] leading-[1.55] text-[var(--color-fg-muted)]">
            Audit tokens wrap every score with full provenance. Four governance
            tiers — input filtering, contextual modeling, output gating, audit
            sealing — each with passing gates, evidence count, and retrieval
            timestamps. Independently verifiable. Downloadable as JSON.
          </p>
          <Link
            href={"/methodology" as never}
            className="group mt-8 inline-flex items-center gap-2 text-[var(--color-accent)] text-[16px] hover:underline-offset-4 hover:underline"
          >
            View the methodology
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <div
          className="relative"
          style={{ animation: "glassbox-fade-up 0.6s ease-out 0.15s both" }}
        >
          <ProofTokenStack />
        </div>
      </div>
    </section>
  );
}

function ProofTokenStack() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute right-3 top-8 bottom-8 w-px bg-[var(--color-accent)]/30"
      />
      <div className="space-y-3">
        {TIERS.map((label, i) => (
          <div
            key={label}
            style={{ animation: `glassbox-fade-up 0.5s ease-out ${0.4 + i * 0.08}s both` }}
            className="rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] h-16 px-6 flex items-center justify-between"
          >
            <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              {label}
            </span>
            <StaticCheck />
          </div>
        ))}
      </div>
    </div>
  );
}

function StaticCheck() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="var(--color-accent)" strokeWidth="1" opacity="0.4" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}
