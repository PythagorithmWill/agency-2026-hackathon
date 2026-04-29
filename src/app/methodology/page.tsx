import { ProofHeader } from "@/components/ProofHeader";
import { FORBIDDEN_ABSOLUTE, FORBIDDEN_CAUSAL } from "@/lib/gov/validators";
import { MethodologyTryItYourself } from "@/components/MethodologyTryItYourself";

export const metadata = {
  title: "Methodology — Pythagorithm Proof",
};

const REJECTED_EXAMPLES: { phrase: string; rewrite: string }[] = [
  { phrase: "The government failed to deliver the program.", rewrite: "The dataset does not show recorded outcomes for this program." },
  { phrase: "Evidence of fraud in the contribution.", rewrite: "Pattern consistent with sole-source amendment growth across the agreement chain." },
  { phrase: "This grant should have stated its outcomes.", rewrite: "Comparable filings in this program typically state expected outcomes." },
  { phrase: "The donations were in exchange for grants.", rewrite: "Lobbying registrations were filed 47 days before grant award dates." },
  { phrase: "This raises serious questions about oversight.", rewrite: "The dataset shows 31 amendments to the underlying contribution agreement." },
];

const ACCEPTED_EXAMPLES = [
  "The dataset shows federal contributions totalling $134M between fiscal 2017 and fiscal 2024.",
  "Pattern consistent with sole-source amendment growth across the agreement chain.",
  "Records indicate the contribution agreement was terminated on July 3, 2020.",
  "Comparable filings typically state the program stream and the recipient's expected outcomes.",
  "Public records do not contain a final disposition statement for this contribution.",
];

const AIA_CORRESPONDENCE: { tier: string; pythagorithm: string; aia: string }[] = [
  { tier: "Tier 1 (Input)", pythagorithm: "Filters applied + landmines respected", aia: "Project Description + scope of automated decisions" },
  { tier: "Tier 2 (Context)", pythagorithm: "Model + prompt version + temperature + token counts", aia: "Risk Assessment — algorithm class, training data, error modes" },
  { tier: "Tier 3 (Output)", pythagorithm: "Citation count, max-quote length, calibration verdict", aia: "Mitigation Measures — peer review, monitoring, recourse" },
  { tier: "Tier 4 (Audit)", pythagorithm: "Operator agent, token hash, previousTokenHash chain", aia: "Approval & Review — sign-off, periodic re-assessment" },
];

const LANDMINES: { id: string; what: string; guard: string }[] = [
  { id: "F-1", what: "ref_number collisions across distinct recipients (~41K rows)", guard: "Partition by (ref_number, COALESCE(bn, legal_name, _id::text))" },
  { id: "F-3", what: "agreement_value is cumulative — naive SUM triple-counts amendments", guard: "WITH agreement_current AS (DISTINCT ON ... ORDER BY amendment_number DESC)" },
  { id: "A-13", what: "AB exact duplicates + 951 reversal pairs", guard: "Dedupe on (ministry, business_unit_name, recipient, program, amount, payment_date); pair-collapse opposite-sign matches" },
  { id: "A-10", what: "AB recipient-NULL roll-up rows (~$25B in FY24+25)", guard: "Filter recipient IS NOT NULL; disclose the omitted aggregate" },
  { id: "C-7", what: "CRA name history is mostly missing (1.4% of BNs)", guard: "Treat cra.cra_identification.legal_name as current-state, not historical" },
];

const AGENTS: { id: string; stratum: string; role: string }[] = [
  { id: "PYTH-LEAD", stratum: "Task agent (descends along strands)", role: "Orchestrator, schedule, scope cuts" },
  { id: "PYTH-DB", stratum: "S4 source-linked", role: "Canonical SQL; landmine-guarded queries" },
  { id: "PYTH-RES", stratum: "S4 source-linked", role: "AG, DRR, Hansard, news retrieval; citation registry" },
  { id: "PYTH-SYN", stratum: "S3 semantic", role: "Brief composition; calibrated synthesis prompts" },
  { id: "PYTH-GOV", stratum: "S3 semantic", role: "Calibrated-language gate; Proof token completeness; veto authority" },
];

export default function MethodologyPage() {
  return (
    <>
      <ProofHeader />
      <main className="mx-auto max-w-[760px] px-8 py-16">
        <header>
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Methodology
          </div>
          <h1 className="mt-6 font-[var(--font-display)] text-[var(--text-display-1)] tracking-[var(--tracking-display)] leading-[1.0]">
            The substance behind the surface
          </h1>
          <p className="mt-8 text-[var(--text-body)] leading-[1.55] text-[var(--color-paper)]">
            Every score in the Glass Box, every brief, every Proof token
            on this site is produced under five rules. None of them are
            secret; all are demonstrable; each can be verified against the
            source data on demand.
          </p>
        </header>

        {/* Section 1 — Calibrated language */}
        <Section
          number="01"
          heading="Calibrated language"
          lead="Output describes what the data shows. It does not assign verdicts. It does not aggregate intent. It does not direct the reader."
        >
          <h3 className="mt-8 font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Forbidden patterns (the regex set the validator runs)
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {[...FORBIDDEN_ABSOLUTE, ...FORBIDDEN_CAUSAL].map((p, i) => (
              <code
                key={i}
                className="block font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)] bg-[var(--color-vellum)] border border-[var(--color-rule)] rounded-[6px] px-4 py-2 break-all"
              >
                {p.pattern.toString()}
              </code>
            ))}
          </div>

          <h3 className="mt-12 font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Rejected → calibrated
          </h3>
          <ul className="mt-4 space-y-4">
            {REJECTED_EXAMPLES.map((r, i) => (
              <li key={i} className="border-l-2 border-[var(--color-ember)] pl-4">
                <div className="text-[var(--color-ember)] font-[var(--font-mono)] text-[var(--text-small)]">
                  ✗ {r.phrase}
                </div>
                <div className="mt-1 text-[var(--color-sage)] font-[var(--font-mono)] text-[var(--text-small)]">
                  ✓ {r.rewrite}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-12 font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Try it yourself
          </h3>
          <p className="mt-2 text-[var(--text-small)] text-[var(--color-muted)]">
            Type any sentence below. PYTH-GOV will run the calibration
            sweep against it in real time, the same way every Brief
            sentence is gated before it ships.
          </p>
          <MethodologyTryItYourself />

          <h3 className="mt-12 font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Accepted phrasings
          </h3>
          <ul className="mt-4 space-y-2 text-[var(--text-small)] leading-[1.55]">
            {ACCEPTED_EXAMPLES.map((s, i) => (
              <li key={i} className="text-[var(--color-paper)]">· {s}</li>
            ))}
          </ul>
        </Section>

        {/* Section 2 — Citation discipline */}
        <Section
          number="02"
          heading="Citation discipline"
          lead="Every prose claim ships with at least one source pointer. No quote may exceed 15 words. No source may be quoted directly more than once."
        >
          <ul className="mt-6 space-y-3 text-[var(--text-small)] leading-[1.55]">
            <li><strong className="text-[var(--color-paper)]">Tier 1</strong> — Auditor General reports (federal, provincial). Highest authority.</li>
            <li><strong className="text-[var(--color-paper)]">Tier 2</strong> — Departmental Results Reports, Hansard, parliamentary committee evidence.</li>
            <li><strong className="text-[var(--color-paper)]">Tier 3</strong> — Major-outlet news with editorial review (Globe, La Presse, CBC investigative).</li>
            <li><strong className="text-[var(--color-paper)]">Tier 4</strong> — Other news. Requires multiple corroborating sources before any claim ships.</li>
          </ul>
        </Section>

        {/* Section 3 — Proof token */}
        <Section
          number="03"
          heading="The Proof token"
          lead="Every output of an accountability AI must itself be accountable. The token records what evaluated the input, what model produced the analysis, what gates passed, and what audit was issued."
        >
          <pre className="mt-4 overflow-x-auto rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-vellum)] p-4 font-[var(--font-mono)] text-[var(--text-mono)] leading-relaxed text-[var(--color-paper)]">
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

        {/* Section 4 — AIA correspondence */}
        <Section
          number="04"
          heading="Structural correspondence with the federal AIA"
          lead="The Pythagorithm Proof token is structurally equivalent to a Treasury Board Algorithmic Impact Assessment, applied at every output rather than once at deployment."
        >
          <table className="mt-4 w-full border-collapse text-[var(--text-small)]">
            <thead>
              <tr className="border-b border-[var(--color-rule)]">
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">Tier</th>
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">Pythagorithm Proof</th>
                <th className="py-3 text-left font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">Federal AIA</th>
              </tr>
            </thead>
            <tbody>
              {AIA_CORRESPONDENCE.map((row) => (
                <tr key={row.tier} className="border-b border-[var(--color-rule)]">
                  <td className="py-3 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">{row.tier}</td>
                  <td className="py-3 text-[var(--color-paper)] leading-[1.4]">{row.pythagorithm}</td>
                  <td className="py-3 text-[var(--color-paper)] leading-[1.4]">{row.aia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Section 5 — Data landmines */}
        <Section
          number="05"
          heading="Data landmines"
          lead="The corpus carries documented defects. Every canonical query guards against them explicitly. The Proof token's Tier 1 records which guards applied."
        >
          <ul className="mt-4 space-y-4">
            {LANDMINES.map((l) => (
              <li key={l.id} className="border-l border-[var(--color-rule)] pl-4">
                <div className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-ember)]">
                  {l.id}
                </div>
                <div className="mt-1 text-[var(--text-small)] text-[var(--color-paper)]">{l.what}</div>
                <div className="mt-2 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)] leading-[1.5]">
                  Guard: {l.guard}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Section 6 — Agents */}
        <Section
          number="06"
          heading="The five agents"
          lead="Each agent operates within bounded perception. The strata are not decorative — they are how the architecture is scoped."
        >
          <ul className="mt-4 space-y-4">
            {AGENTS.map((a) => (
              <li key={a.id}>
                <div className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)]">
                  {a.id} · {a.stratum}
                </div>
                <div className="mt-1 text-[var(--text-small)] text-[var(--color-muted)] leading-[1.5]">
                  {a.role}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-24 border-t border-[var(--color-rule)] pt-8 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          Cite as: Pythagorithm Proof Methodology v1.0, retrieved {new Date().toISOString().slice(0, 10)}.
        </footer>
      </main>
    </>
  );
}

function Section({
  number,
  heading,
  lead,
  children,
}: {
  number: string;
  heading: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-24">
      <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
        {number}
      </div>
      <h2 className="mt-3 font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)] leading-[1.15]">
        {heading}
      </h2>
      <p className="mt-4 text-[var(--text-body)] text-[var(--color-paper)] leading-[1.55]">
        {lead}
      </p>
      {children}
    </section>
  );
}
