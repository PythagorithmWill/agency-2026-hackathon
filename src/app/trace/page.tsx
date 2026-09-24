import Link from "next/link";

export const metadata = { title: "Built on Alberta TRACE — Glassbox" };

export default function TracePage() {
  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[920px] px-4 sm:px-6 pt-24 pb-12">
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

      <article className="mx-auto max-w-[760px] px-4 sm:px-6 py-16 space-y-14 text-[16px] leading-[1.65] text-[var(--color-fg)]">
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
            <span className="italic"> Substack</span>, April 13 2026 (as recorded in
            Glassbox&apos;s Session 8 TRACE integration report).
          </p>
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 text-[15px] text-[var(--color-fg-muted)]">
            <b className="text-[var(--color-fg)]">A note on naming.</b> The term
            &ldquo;TRACE&rdquo; does not appear anywhere in the upstream repository Glassbox
            builds on (the Alberta &ldquo;AI For Accountability Hackathon&rdquo; data platform —
            its <code className="font-[var(--font-mono)] text-[13px]">FED/</code>,{" "}
            <code className="font-[var(--font-mono)] text-[13px]">CRA/</code>,{" "}
            <code className="font-[var(--font-mono)] text-[13px]">AB/</code> and{" "}
            <code className="font-[var(--font-mono)] text-[13px]">general/</code> modules).
            The mapping between the Ministry&apos;s published description of TRACE and the
            upstream analysis scripts listed in the provenance table below is Glassbox&apos;s
            interpretation, not a label the upstream authors applied. Where a Glassbox pattern
            has a direct upstream script, the path is cited; where it does not, the pattern is
            marked Glassbox-native.
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

        <Section number="03" title="Where Glassbox departs from upstream">
          <p className="text-[var(--color-fg-muted)]">
            Several thresholds and windows in Glassbox are Glassbox choices. They are listed here
            so no reader mistakes them for upstream or Ministry definitions.
          </p>
          <ul className="list-disc pl-5 space-y-3 marker:text-[var(--color-fg-subtle)]">
            <li>
              <b>Loop-score attention threshold of 12 is a Glassbox choice.</b> The upstream
              scoring script (<code className="font-[var(--font-mono)] text-[13px]">CRA/scripts/advanced/02-score-universe.js</code>)
              reports the score distribution at ≥ 15 and ≥ 10; it does not define an
              &ldquo;attention&rdquo; cut. Glassbox&apos;s 12 / 15 / 18 bands are calibration
              choices for the observation / attention / flag pills.
            </li>
            <li>
              <b>Zombie recipients use a rolling 36-month window.</b> The upstream script
              (<code className="font-[var(--font-mono)] text-[13px]">FED/scripts/advanced/05-zombie-and-ghost.js</code>)
              uses a fixed cutoff — last agreement start before{" "}
              <code className="font-[var(--font-mono)] text-[13px]">2022-01-01</code>. Glassbox
              instead measures silence relative to the refresh date (last agreement start &lt;
              today − 36 months), so the set moves forward with each refresh rather than
              growing indefinitely against a stale date.
            </li>
            <li>
              <b>Evidence strength is a Glassbox score.</b> Every stored match carries an
              evidence-strength value in [0, 1] — a read on how much of the published record
              supports the match (row volume, recency, corroborating rows across sources),
              separate from severity. Labelled weak (&lt; 0.40), moderate (&lt; 0.70) and strong
              (≥ 0.70). Formula reference:{" "}
              <code className="font-[var(--font-mono)] text-[13px]">src/lib/patterns/strength.ts</code>.
            </li>
            <li>
              <b>Thresholds are relative, with rolling windows.</b> Where v1 used fixed
              dollar and ratio cutoffs, v2 detectors express thresholds as percentiles of the
              comparable population (same department, program or fiscal-year window) and
              recompute them on every refresh. A match is therefore &ldquo;top decile of its
              peers this window&rdquo;, not &ldquo;above a number chosen in April&rdquo;.
            </li>
            <li>
              <b>Amendment values are cumulative.</b> In the federal corpus,{" "}
              <code className="font-[var(--font-mono)] text-[13px]">agreement_value</code> on an
              amendment row is the running total, not the increment (landmine F-3). Every growth
              ratio Glassbox reports is <i>latest ÷ original</i> for the chain keyed by
              (<code className="font-[var(--font-mono)] text-[13px]">ref_number</code>, business
              number or legal name) per landmine F-1 — never a sum across amendment rows.
            </li>
          </ul>
          <p className="text-[var(--color-fg-muted)]">
            The operator-facing description of the v2 pipeline is in{" "}
            <code className="font-[var(--font-mono)] text-[13px]">docs/METHODOLOGY-V2.md</code>.
          </p>
        </Section>

        <Section number="04" title="Data lineage and provenance">
          <p className="text-[var(--color-fg-muted)] mb-4">
            Which Glassbox surface uses which upstream data product, and whether the detection
            logic comes from an upstream script, from Glassbox, or both. Upstream paths are
            relative to the upstream repository root.
          </p>
          <div className="-mx-4 sm:mx-0 overflow-x-auto px-4 sm:px-0">
          <table className="w-full min-w-[720px] text-[13px] border-t border-[var(--color-border)]">
            <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="text-left py-2 pr-4">Glassbox surface</th>
                <th className="text-left py-2 pr-4">Upstream data product</th>
                <th className="text-left py-2">Provenance</th>
              </tr>
            </thead>
            <tbody>
              <Row
                a="/follow/funding-loops"
                b="cra.loop_universe (5,808) · cra.loop_financials"
                prov="both"
                path="CRA/scripts/advanced/01-detect-all-loops.js · 02-score-universe.js · 07-loop-financial-analysis.js"
              />
              <Row
                a="/follow/zombie-recipients"
                b="fed.grants_contributions · cra.t3010_plausibility_flags"
                prov="both"
                path="FED/scripts/advanced/05-zombie-and-ghost.js (fixed 2022-01-01 cutoff upstream; rolling 36-month window here)"
              />
              <Row
                a="/follow/ghost-capacity"
                b="fed.grants_contributions · general.entity_golden_records"
                prov="both"
                path="FED/scripts/advanced/05-zombie-and-ghost.js"
              />
              <Row
                a="/follow/sole-source-creep"
                b="fed.grants_contributions amendment chains · ab sole-source"
                prov="both"
                path="FED/scripts/advanced/03-amendment-creep.js · AB/scripts/advanced/04-sole-source-deep-dive.js"
              />
              <Row
                a="/follow/vendor-concentration"
                b="fed.grants_contributions departmental spend"
                prov="both"
                path="FED/scripts/advanced/04-recipient-concentration.js (HHI banding is Glassbox)"
              />
              <Row
                a="/recipient/[bn]"
                b="general.entity_golden_records (851 K, 98% match accuracy)"
                prov="upstream-script"
                path="general/scripts/04-resolve-entities.js … 09-build-golden-records.js"
              />
              <Row
                a="/follow/related-parties · /follow/duplicative-funding"
                b="general.entity_golden_records (dataset_sources, source_link_count)"
                prov="Glassbox"
                path="Golden records upstream; the cross-dataset pattern logic is Glassbox (FED/scripts/advanced/09-fed-cra-crossref.js is the nearest upstream analogue)"
              />
              <Row
                a="/follow/policy-misalignment · /follow/amendment-purpose-drift"
                b="fed.grants_contributions program text"
                prov="Glassbox"
                path={null}
              />
              <Row
                a="/transparency/recipients"
                b="cra.matrix_census · concentration analysis"
                prov="both"
                path="CRA/scripts/advanced/04-matrix-power-census.js · FED/scripts/advanced/04-recipient-concentration.js"
              />
              <Row
                a="/transparency/data-quality"
                b="Documented landmines F-* / C-* / A-*"
                prov="both"
                path="AB/scripts/advanced/01-data-quality-audit.js · upstream KNOWN-DATA-ISSUES.md"
              />
            </tbody>
          </table>
          </div>
        </Section>

        <Section number="05" title="Aligned with the Alberta AI Usage Policy">
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

        <Section number="06" title="Disclaimer">
          <p className="text-[var(--color-fg-muted)] italic">
            Alberta Ministry of Technology and Innovation has not endorsed Glassbox. We credit the
            TRACE methodology lineage; we do not claim partnership. Glassbox observations from
            public records are not findings of misconduct.
          </p>
        </Section>

        <Section number="07" title="Cite as">
          <code className="block bg-[var(--color-bg-elev-1)] border border-[var(--color-border)] rounded-md p-4 font-[var(--font-mono)] text-[13px] leading-relaxed">
            Glassbox by Pythagorithm AI Governance Solutions, built on Alberta TRACE methodology,
            retrieved {new Date().toISOString().slice(0, 10)}.
          </code>
        </Section>
      </article>

      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[760px] px-4 sm:px-6 flex flex-wrap items-baseline justify-between gap-4">
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

type Provenance = "upstream-script" | "Glassbox" | "both";

const PROV_STYLE: Record<Provenance, string> = {
  "upstream-script": "text-[var(--color-fg-muted)]",
  Glassbox: "text-[var(--color-accent)]",
  both: "text-[var(--color-accent-warn)]",
};

function Row({
  a,
  b,
  prov,
  path,
}: {
  a: string;
  b: string;
  prov: Provenance;
  path: string | null;
}) {
  return (
    <tr className="border-b border-[var(--color-border)] align-top">
      <td className="py-2 pr-4 font-[var(--font-mono)] text-[12px] text-[var(--color-accent)]">
        {a}
      </td>
      <td className="py-2 pr-4 text-[var(--color-fg-muted)]">{b}</td>
      <td className="py-2">
        <div className={`font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] ${PROV_STYLE[prov]}`}>
          {prov}
        </div>
        {path && (
          <div className="mt-1 font-[var(--font-mono)] text-[11px] leading-[1.5] text-[var(--color-fg-subtle)] break-words">
            {path}
          </div>
        )}
      </td>
    </tr>
  );
}
