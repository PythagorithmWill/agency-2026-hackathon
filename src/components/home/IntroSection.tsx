/**
 * What-this-is intro section. Sits between the hero photograph and the
 * Follow-the-Money pattern grid, on the dark background. Editorial
 * two-column layout: left column anchors the canonical "Follow the
 * money" phrase, right column expands it into what Glassbox actually
 * does.
 *
 * Plain markup — reveal is owned by the parent ScrollReveal wrapper
 * in src/app/page.tsx. No framer-motion (see project rule against
 * mount-time framer animations).
 */
export function IntroSection() {
  return (
    <section className="border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-16 py-32 md:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Left column — label + canonical phrase */}
          <div className="lg:col-span-5">
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              01 · What this is
            </div>
            <h2 className="mt-4 text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[-0.035em] font-medium">
              Follow the money<span className="text-[var(--color-accent)]">.</span>
            </h2>
            <p className="mt-6 italic text-[18px] leading-[28px] text-[var(--color-fg-muted)] max-w-[360px]">
              The question is concrete: where does Canada&apos;s public money
              go, and to whom?
            </p>
          </div>

          {/* Right column — explainer */}
          <div className="lg:col-span-7 space-y-6 text-[var(--color-fg)]">
            <p className="text-[20px] md:text-[22px] leading-[32px] tracking-[-0.005em]">
              Glassbox traces federal grants, Alberta contracts, charity flows,
              and sole-source amendments across millions of records. Every
              figure cites its source row. Calibrated language. Audit-ready.
            </p>
            <p className="text-[16px] leading-[26px] text-[var(--color-fg-muted)]">
              We surface twelve named patterns of public-spending behaviour —
              circular charity flows, contract growth far beyond the original
              bid, recipients that vanished after the money flowed, departments
              dominated by a single supplier. Each pattern is a search you can
              run against the corpus, with severity bands, evidence arrays, and
              calibrated next-step recommendations.
            </p>
            <p className="text-[16px] leading-[26px] text-[var(--color-fg-muted)]">
              Built on Alberta&apos;s TRACE methodology, extended to the federal
              corpus, packaged as a public interface. Open source, MIT, with
              audit tokens chained to source data tokens — so the &ldquo;why
              this match?&rdquo; trail can always be walked back.
            </p>

            <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-[var(--color-border)]">
              <Stat label="Federal records" value="1.27 M" />
              <Stat label="Alberta records" value="2.05 M" />
              <Stat label="Canonical entities" value="851 K" />
              <Stat label="Funding loops" value="5.8 K" />
              <Stat label="Named patterns" value="12" />
              <Stat label="Detectors live" value="6" />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <div className="font-[var(--font-mono)] text-[28px] leading-none tracking-[-0.02em] tabular-nums text-[var(--color-fg)]">
        {value}
      </div>
      <div className="mt-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
    </li>
  );
}
