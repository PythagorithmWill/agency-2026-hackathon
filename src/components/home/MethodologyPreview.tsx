import Link from "next/link";

/**
 * Section F — methodology teaser. Heading, two paragraphs, then a
 * three-card mini-row (regex, flag, calibrated pair). Links to
 * /methodology.
 *
 * No framer-motion — section reveal is handled by the parent
 * ScrollReveal wrapper in src/app/page.tsx.
 */
export function MethodologyPreview() {
  return (
    <section className="mx-auto max-w-[800px] px-6 py-32">
      <h2 className="text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-[-0.025em] font-semibold">
        The substance behind the surface.
      </h2>

      <div className="mt-8 space-y-6 text-[16px] leading-[1.55] text-[var(--color-fg-muted)]">
        <p>
          Glassbox runs every output against a published regex set, a citation
          discipline, and an audit-token schema. The validator is open. The
          scoring is reproducible. The audit trail is the product.
        </p>
        <p>
          View the full methodology — including the calibrated lexicon, the
          data landmines, the AIA structural correspondence, and a live
          try-it-yourself validator.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniCard
          variant="regex"
          label="forbidden_absolute"
          body={`/\\b(fraud|fraudulent|corrupt|illegal)\\b/i`}
        />
        <MiniCard variant="flag" label="GLASSBOX-GOV" body="12 flags" />
        <MiniCard variant="pair" label="rejected → calibrated" body="" />
      </div>

      <div className="mt-10">
        <Link
          href={"/methodology" as never}
          className="group inline-flex items-center gap-2 text-[var(--color-accent)] text-[16px] hover:underline-offset-4 hover:underline"
        >
          Read the full methodology
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}

function MiniCard({
  variant,
  label,
  body,
}: {
  variant: "regex" | "flag" | "pair";
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-4 min-h-[112px]">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      {variant === "regex" && (
        <div className="mt-3 font-[var(--font-mono)] text-[12px] leading-[1.5] text-[var(--color-fg)] break-all">
          {body}
        </div>
      )}
      {variant === "flag" && (
        <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-accent-warn)]/15 border border-[var(--color-accent-warn)]/40 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent-warn)]">
          {body}
        </div>
      )}
      {variant === "pair" && (
        <div className="mt-3 space-y-1.5 font-[var(--font-mono)] text-[11px] leading-[1.5]">
          <div className="text-[var(--color-accent-fail)] line-through decoration-[var(--color-accent-fail)]/60">
            should have
          </div>
          <div className="text-[var(--color-accent)]">
            comparable filings typically state
          </div>
        </div>
      )}
    </div>
  );
}
