import Link from "next/link";
import { FORBIDDEN_ABSOLUTE, FORBIDDEN_CAUSAL } from "@/lib/gov/validators";
import { MethodologyTryItYourself } from "@/components/MethodologyTryItYourself";

export const metadata = { title: "Methodology — Pythagorithm" };

const REJECTED: { phrase: string; rewrite: string }[] = [
  { phrase: "The government failed to deliver the program.", rewrite: "The dataset does not show recorded outcomes for this program." },
  { phrase: "Evidence of fraud in the contribution.", rewrite: "Pattern consistent with sole-source amendment growth across the agreement chain." },
  { phrase: "This grant should have stated its outcomes.", rewrite: "Comparable filings in this program typically state expected outcomes." },
  { phrase: "The donations were in exchange for grants.", rewrite: "Lobbying registrations were filed 47 days before grant award dates." },
  { phrase: "This raises serious questions about oversight.", rewrite: "The dataset shows 31 amendments to the underlying contribution agreement." },
];

const ACCEPTED = [
  "The dataset shows federal contributions totalling $134M between fiscal 2017 and fiscal 2024.",
  "Pattern consistent with sole-source amendment growth across the agreement chain.",
  "Records indicate the contribution agreement was terminated on July 3, 2020.",
  "Comparable filings typically state the program stream and the recipient's expected outcomes.",
  "Public records do not contain a final disposition statement for this contribution.",
];

const AIA_TABLE: { tier: string; pythagorithm: string; aia: string }[] = [
  { tier: "Tier 1 (Input)", pythagorithm: "Filters applied + landmines respected (F-3, A-13, A-10)", aia: "Project Description + scope of automated decisions" },
  { tier: "Tier 2 (Context)", pythagorithm: "Embedding model + synthesis prompt version + temperature", aia: "Risk Assessment — algorithm class, training data, error modes" },
  { tier: "Tier 3 (Output)", pythagorithm: "Citation count, max-quote length, calibration verdict", aia: "Mitigation Measures — peer review, monitoring, recourse" },
  { tier: "Tier 4 (Audit)", pythagorithm: "Operator agent, token hash, previousTokenHash chain", aia: "Approval & Review — sign-off, periodic re-assessment" },
];

const LANDMINES: { id: string; what: string; guard: string }[] = [
  { id: "F-1", what: "ref_number collisions across distinct recipients (~41K rows)", guard: "Partition by (ref_number, COALESCE(bn, legal_name, _id::text))" },
  { id: "F-3", what: "agreement_value is cumulative — naive SUM triple-counts amendments", guard: "WITH agreement_current AS (DISTINCT ON … ORDER BY amendment_number DESC)" },
  { id: "A-13", what: "AB exact duplicates + 951 reversal pairs", guard: "Dedupe on (ministry, business_unit_name, recipient, program, amount, payment_date); pair-collapse opposite-sign matches" },
  { id: "A-10", what: "AB recipient-NULL roll-up rows (~$25B in FY24+25)", guard: "Filter recipient IS NOT NULL; disclose the omitted aggregate" },
  { id: "C-7", what: "CRA name history is mostly missing (1.4% of BNs)", guard: "Treat cra.cra_identification.legal_name as current-state, not historical" },
];

const AGENTS: { id: string; stratum: string; role: string }[] = [
  { id: "PYTH-LEAD", stratum: "Task agent (descends along provenance strands)", role: "Orchestrator, schedule, scope cuts" },
  { id: "PYTH-DATA", stratum: "S4 source-linked", role: "Canonical SQL, landmine guards, hybrid retrieval, embedding job" },
  { id: "PYTH-SYN", stratum: "S3 semantic", role: "Similarity scoring, awardee patterns, calibrated recommendation text" },
  { id: "PYTH-FE", stratum: "S2 procedural", role: "Every UI component, every page, every motion. Reads DESIGN-SYSTEM.md as authoritative." },
  { id: "PYTH-GOV", stratum: "S3 semantic", role: "Calibrated-language gate, Proof token completeness, route-existence + visual smoke gates. Veto authority." },
];

export default function MethodologyPage() {
  return (
    <main className="atmosphere-mesh min-h-screen">
      <header className="mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Link href={"/" as never} className="hover:text-[var(--color-fg)]">
          ← Pythagorithm
        </Link>
        <Link href={"/evaluate" as never} className="hover:text-[var(--color-fg)]">
          Evaluate a draft
        </Link>
      </header>

      <article className="mx-auto max-w-[760px] px-6 py-24">
        <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Methodology
        </div>
        <h1 className="mt-6 text-[var(--text-display-lg)] tracking-[var(--tracking-display-lg)] font-semibold leading-[68px]">
          The substance behind the surface.
        </h1>
        <p className="mt-8 text-[var(--text-body-lg)] leading-[28px] text-[var(--color-fg)]">
          Every score in this product, every comparable record, every
          recommendation is produced under five rules. None are secret;
          all are demonstrable; each can be verified against the source
          data on demand.
        </p>

        <Section number="01" heading="Calibrated language">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            Output describes what the data shows. It does not assign verdicts.
            It does not aggregate intent. It does not direct the reader.
          </p>

          <h3 className="mt-12 text-[var(--text-heading)] font-semibold tracking-[var(--tracking-heading)]">
            Forbidden patterns
          </h3>
          <div className="mt-4 space-y-2">
            {[...FORBIDDEN_ABSOLUTE, ...FORBIDDEN_CAUSAL].map((p, i) => (
              <code
                key={i}
                className="block font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg)] bg-[var(--color-bg-elev-1)] border border-[var(--color-border)] rounded-[8px] px-4 py-2 break-all"
              >
                {p.pattern.toString()}
              </code>
            ))}
          </div>

          <h3 className="mt-12 text-[var(--text-heading)] font-semibold tracking-[var(--tracking-heading)]">
            Rejected → calibrated
          </h3>
          <ul className="mt-4 space-y-4">
            {REJECTED.map((r, i) => (
              <li key={i} className="border-l-2 border-[var(--color-accent-warn)] pl-4">
                <div className="font-[var(--font-mono)] text-[var(--text-body-sm)] text-[var(--color-accent-warn)]">
                  ✗ {r.phrase}
                </div>
                <div className="mt-1 font-[var(--font-mono)] text-[var(--text-body-sm)] text-[var(--color-accent)]">
                  ✓ {r.rewrite}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-12 text-[var(--text-heading)] font-semibold tracking-[var(--tracking-heading)]">
            Try it yourself
          </h3>
          <p className="mt-2 text-[var(--text-body-sm)] text-[var(--color-fg-muted)] leading-[20px]">
            Type any sentence below. PYTH-GOV runs the calibration sweep
            against it in real time, the same way every output is gated
            before it ships.
          </p>
          <MethodologyTryItYourself />

          <h3 className="mt-12 text-[var(--text-heading)] font-semibold tracking-[var(--tracking-heading)]">
            Accepted phrasings
          </h3>
          <ul className="mt-4 space-y-2 text-[var(--text-body-sm)] leading-[20px]">
            {ACCEPTED.map((s, i) => (
              <li key={i} className="text-[var(--color-fg)]">· {s}</li>
            ))}
          </ul>
        </Section>

        <Section number="02" heading="Citation discipline">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            Every prose claim ships with at least one source pointer.
            No quote may exceed 15 words. No source may be quoted
            directly more than once.
          </p>
          <ul className="mt-6 space-y-3 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg)]">
            <li><strong>Tier 1</strong> — Auditor General reports. Highest authority.</li>
            <li><strong>Tier 2</strong> — Departmental Results Reports, Hansard, parliamentary committee evidence.</li>
            <li><strong>Tier 3</strong> — Major-outlet news with editorial review (Globe, La Presse, CBC investigative).</li>
            <li><strong>Tier 4</strong> — Other news. Requires multiple corroborating sources before any claim ships.</li>
          </ul>
        </Section>

        <Section number="03" heading="The Proof token">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            Every output of an accountability AI must itself be accountable.
            The token records what evaluated the input, what model produced
            the analysis, what gates passed, and what audit was issued.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 font-[var(--font-mono)] text-[var(--text-mono)] leading-relaxed text-[var(--color-fg)]">
{`{
  "proofId":   "ppm-2026-04-29T...-abc123",
  "version":   "1.0",
  "issuedAt":  "...",
  "issuedBy":  "PYTH-LEAD",
  "finding":   { type, summary, subject, score, scoreLabel },
  "evidence":  [{ source, rowId, field, value, asOf }, ...],
  "tiers": {
    "input":     { passed, filtersApplied, knownDataIssuesRespected },
    "contextual":{ passed, model, promptHash, promptVersion, temperature },
    "output":    { passed, calibrationCheck, citationCount, quoteWordCountMax },
    "audit":     { passed, tokenHash, previousTokenHash, operatorAgent, logRef }
  },
  "disclaimers": [
    "Data current as of ...",
    "Entity resolution is probabilistic for cross-dataset matches without BN anchor",
    "These are observations from public records. They are not findings of misconduct."
  ]
}`}
          </pre>
        </Section>

        <Section number="04" heading="Structural correspondence with the federal AIA">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            The Pythagorithm Proof token is structurally equivalent to a
            Treasury Board Algorithmic Impact Assessment, applied at every
            output rather than once at deployment.
          </p>
          <table className="mt-6 w-full border-collapse text-[var(--text-body-sm)]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">Tier</th>
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">Pythagorithm Proof</th>
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">Federal AIA</th>
              </tr>
            </thead>
            <tbody>
              {AIA_TABLE.map((r) => (
                <tr key={r.tier} className="border-b border-[var(--color-border)]">
                  <td className="py-3 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)]">{r.tier}</td>
                  <td className="py-3 text-[var(--color-fg)] leading-[20px]">{r.pythagorithm}</td>
                  <td className="py-3 text-[var(--color-fg)] leading-[20px]">{r.aia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section number="05" heading="Data landmines">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            The corpus carries documented defects. Every canonical query
            guards against them explicitly. The Proof token's Tier 1
            records which guards applied.
          </p>
          <ul className="mt-6 space-y-4">
            {LANDMINES.map((l) => (
              <li key={l.id} className="border-l border-[var(--color-border)] pl-4">
                <div className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-accent-warn)]">
                  {l.id}
                </div>
                <div className="mt-1 text-[var(--text-body-sm)] text-[var(--color-fg)]">{l.what}</div>
                <div className="mt-2 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)] leading-[20px]">
                  Guard: {l.guard}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="06" heading="The five agents">
          <p className="text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            Each agent operates within bounded perception. The strata are
            not decorative — they are how the architecture is scoped.
          </p>
          <ul className="mt-6 space-y-4">
            {AGENTS.map((a) => (
              <li key={a.id}>
                <div className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg)]">
                  {a.id} · {a.stratum}
                </div>
                <div className="mt-1 text-[var(--text-body-sm)] text-[var(--color-fg-muted)] leading-[20px]">
                  {a.role}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-24 border-t border-[var(--color-border)] pt-8 font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Cite as: Pythagorithm Proof Methodology v1.0, retrieved {new Date().toISOString().slice(0, 10)}.
        </footer>
      </article>
    </main>
  );
}

function Section({
  number,
  heading,
  children,
}: {
  number: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-24">
      <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Section {number}
      </div>
      <h2 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] font-semibold leading-[52px]">
        {heading}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
