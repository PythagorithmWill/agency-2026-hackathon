import Link from "next/link";

export const metadata = { title: "Built on Alberta TRACE — Glassbox" };

export default function TracePage() {
  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[920px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · data lineage
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            Built on Alberta TRACE<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-6 text-[var(--text-body-lg)] italic text-[var(--color-fg-muted)] leading-[1.45]">
            Glassbox surfaces patterns identified through Alberta&apos;s Targeted Review of
            Alberta&apos;s Contracts and Expenditures program, extended across federal data and
            packaged for public access.
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-[760px] px-6 py-16 space-y-14 text-[16px] leading-[1.65] text-[var(--color-fg)]">
        <Section number="01" title="What is TRACE?">
          <p>
            TRACE — Targeted Review of Alberta&apos;s Contracts and Expenditures — is a program of
            the Alberta Ministry of Technology and Innovation. It uses agentic AI on open
            government datasets to identify patterns of interest in public spending: charity
            funding loops, ghost-capacity entities, sole-source amendment growth, and several
            others. TRACE&apos;s data outputs (entity matching, loop detection, anomaly flags) are
            published in the
            {" "}
            <code className="font-[var(--font-mono)] text-[14px] text-[var(--color-accent)]">cra.*</code>
            {" "}and{" "}
            <code className="font-[var(--font-mono)] text-[14px] text-[var(--color-accent)]">general.*</code>
            {" "}schemas of the read-only Render replica that Glassbox queries.
          </p>
          <p className="text-[var(--color-fg-muted)]">
            Source citation: Nate Glubish, &ldquo;We&apos;re taking Alberta&apos;s AI to Ottawa&rdquo;,
            <span className="italic"> Substack</span>, April 13 2026.
          </p>
        </Section>

        <Section number="02" title="What Glassbox adds">
          <ul className="list-disc pl-5 space-y-2 marker:text-[var(--color-fg-subtle)]">
            <li>
              <b>Federal corpus expansion.</b> TRACE is built on Alberta provincial data; Glassbox
              extends every TRACE-derived pattern to the 1.27 M-row federal grants &amp;
              contributions corpus.
            </li>
            <li>
              <b>Calibrated-language discipline.</b> Every Glassbox output passes the calibration
              sweep — no &ldquo;fraud&rdquo;, no &ldquo;clearly shows&rdquo;, no &ldquo;should
              have&rdquo;, no causal claims. Patterns surface correlation and observation, not
              guilt.
            </li>
            <li>
              <b>Audit-token provenance.</b> Every output carries an audit token chained to the
              source data tokens, so the &ldquo;why this match?&rdquo; trail can always be walked
              back.
            </li>
            <li>
              <b>Public-facing UX.</b> TRACE is an internal review program. Glassbox is its public
              interface — searchable, browsable, citable.
            </li>
          </ul>
        </Section>

        <Section number="03" title="Data lineage">
          <p className="text-[var(--color-fg-muted)] mb-4">
            Which Glassbox surface uses which TRACE data product:
          </p>
          <table className="w-full text-[13px] border-t border-[var(--color-border)]">
            <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="text-left py-2 pr-4">Glassbox surface</th>
                <th className="text-left py-2">TRACE data product</th>
              </tr>
            </thead>
            <tbody>
              <Row a="/follow/funding-loops" b="cra.loop_universe (5,808) · cra.loop_financials" />
              <Row a="/follow/zombie-recipients" b="cra.t3010_impossibilities · cra.t3010_plausibility_flags" />
              <Row a="/follow/ghost-capacity" b="cra.t3010 · general.entity_golden_records" />
              <Row a="/recipient/[bn]" b="general.entity_golden_records (851 K, 98% match accuracy)" />
              <Row a="/follow/sole-source-creep" b="cra.identified_hubs (cross-reference)" />
              <Row a="/transparency/recipients" b="cra.matrix_census · concentration analysis" />
            </tbody>
          </table>
        </Section>

        <Section number="04" title="Aligned with the Alberta AI Usage Policy">
          <p>
            Glassbox is designed to align with Alberta&apos;s public-sector AI policy: sovereign
            compute (no third-party AI for pattern detection — calibration enforcement is local
            regex, semantic retrieval is opt-in), open-source models, audit trails on every
            output, and accountability via citation rigor. See
            {" "}
            <Link href={"/compliance" as never} className="text-[var(--color-accent)] hover:underline">
              the compliance mapping
            </Link>
            {" "}for the line-by-line policy correspondence.
          </p>
        </Section>

        <Section number="05" title="Disclaimer">
          <p className="text-[var(--color-fg-muted)] italic">
            Alberta Ministry of Technology and Innovation has not endorsed Glassbox. We credit the
            TRACE methodology lineage; we do not claim partnership. Glassbox observations from
            public records are not findings of misconduct.
          </p>
        </Section>

        <Section number="06" title="Cite as">
          <code className="block bg-[var(--color-bg-elev-1)] border border-[var(--color-border)] rounded-md p-4 font-[var(--font-mono)] text-[13px] leading-relaxed">
            Glassbox by Pythagorithm AI Governance Solutions, built on Alberta TRACE methodology,
            retrieved {new Date().toISOString().slice(0, 10)}.
          </code>
        </Section>
      </article>

      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[760px] px-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href={"/follow" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← All patterns
          </Link>
          <Link
            href={"/methodology" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Methodology →
          </Link>
        </div>
      </section>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Section {number}
      </div>
      <h2 className="mt-2 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] leading-[1.05]">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="py-2 pr-4 font-[var(--font-mono)] text-[12px] text-[var(--color-accent)]">
        {a}
      </td>
      <td className="py-2 text-[var(--color-fg-muted)]">{b}</td>
    </tr>
  );
}
