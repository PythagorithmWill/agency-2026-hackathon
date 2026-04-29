import Link from "next/link";
import { FORBIDDEN_ABSOLUTE, FORBIDDEN_CAUSAL } from "@/lib/gov/validators";
import { MethodologyTryItYourself } from "@/components/MethodologyTryItYourself";
import { MethodologyHero } from "@/components/methodology/MethodologyHero";
import { RevealSection } from "@/components/methodology/RevealSection";
import { JsonTypewriter } from "@/components/methodology/JsonTypewriter";
import { AnimatedAiaTable } from "@/components/methodology/AnimatedAiaTable";
import { AgentsDiagram } from "@/components/methodology/AgentsDiagram";
import { RegexCard } from "@/components/methodology/RegexCard";
import { PythagorithmMark } from "@/components/glyphs/PythagorithmMark";

export const metadata = { title: "Methodology — Pythagorithm" };

const REGEX_DESCRIPTIONS: { pattern: string; description: string }[] = [
  {
    pattern: FORBIDDEN_ABSOLUTE[0].pattern.toString(),
    description:
      "Catches editorial verdicts (fraud, corruption, criminal). The dataset cannot prove these; PYTH-GOV strips them or asks PYTH-SYN to point to the source making the claim.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[1].pattern.toString(),
    description:
      "Prescriptive language ('should have', 'ought to'). Forbidden because it directs the reader rather than describing what the records show.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[2].pattern.toString(),
    description:
      "Absolute claims ('clearly shows', 'proven', 'definitely'). Replaced with 'records indicate' or 'the dataset shows'.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[3].pattern.toString(),
    description:
      "Imputed-intent verbs ('failed to', 'deliberately', 'knowingly'). Replaced with 'does not show' or 'public records do not contain'.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[4].pattern.toString(),
    description:
      "Editorial framings ('coverup', 'scheme', 'scam'). Stripped — describe the documented pattern instead.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[5].pattern.toString(),
    description:
      "Superlatives ('stunning', 'shocking', 'egregious'). Stripped — let the number speak.",
  },
  {
    pattern: FORBIDDEN_ABSOLUTE[6].pattern.toString(),
    description:
      "Anonymous-source hedges ('allegedly', 'sources say', 'many believe'). Replaced with the cited source by name.",
  },
  {
    pattern: FORBIDDEN_CAUSAL[0].pattern.toString(),
    description:
      "Causal phrasing ('because of [grant/funding]'). Replaced with temporal: 'X occurred N days before Y'.",
  },
  {
    pattern: FORBIDDEN_CAUSAL[1].pattern.toString(),
    description:
      "Causal verbs ('caused', 'led to', 'resulted in'). Replaced with 'preceded' / 'followed' or cite the source asserting the causation.",
  },
  {
    pattern: FORBIDDEN_CAUSAL[2].pattern.toString(),
    description:
      "Quid-pro-quo language ('in exchange for', 'in return for'). Always stripped — unsupported by the dataset.",
  },
  {
    pattern: FORBIDDEN_CAUSAL[3].pattern.toString(),
    description:
      "Reader-direction ('warrants investigation', 'public deserves answers'). Stripped — that's the reader's call.",
  },
];

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

const AIA_TABLE = [
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

const AGENTS = [
  { id: "PYTH-LEAD", stratum: "Task agent (descends along provenance strands)", role: "Orchestrator, schedule, scope cuts" },
  { id: "PYTH-DATA", stratum: "S4 source-linked", role: "Canonical SQL, landmine guards, hybrid retrieval, embedding job" },
  { id: "PYTH-SYN", stratum: "S3 semantic", role: "Similarity scoring, awardee patterns, calibrated recommendation text" },
  { id: "PYTH-FE", stratum: "S2 procedural", role: "Every UI component, every page, every motion. Reads DESIGN-SYSTEM.md as authoritative." },
  { id: "PYTH-GOV", stratum: "S3 semantic", role: "Calibrated-language gate, Proof token completeness, route-existence + visual smoke gates. Veto authority." },
];

export default function MethodologyPage() {
  return (
    <main className="min-h-screen">
      <header className="absolute top-0 left-0 right-0 z-20 mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Link href={"/" as never} className="hover:text-[var(--color-fg)]">
          ← Pythagorithm
        </Link>
        <Link href={"/evaluate" as never} className="hover:text-[var(--color-fg)]">
          Evaluate a draft
        </Link>
      </header>

      <MethodologyHero />

      <article className="mx-auto max-w-[760px] px-6 py-24">
        <RevealSection>
          <h2 className="text-[clamp(40px,5vw,56px)] tracking-[-0.025em] font-semibold leading-[1.1]">
            The substance behind the surface.
          </h2>
          <p className="mt-8 text-[18px] leading-[28px] text-[var(--color-fg)]">
            Every score in this product, every comparable record, every
            recommendation is produced under five rules. None are secret;
            all are demonstrable; each can be verified against the source
            data on demand.
          </p>
        </RevealSection>

        <Section number="01" heading="Calibrated language">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            Output describes what the data shows. It does not assign verdicts.
            It does not aggregate intent. It does not direct the reader.
          </p>

          <h3 className="mt-12 text-[20px] font-semibold tracking-[-0.01em]">
            Forbidden patterns
          </h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-subtle)]">
            Hover any line for a description of what the pattern catches.
          </p>
          <div className="mt-4 space-y-2">
            {REGEX_DESCRIPTIONS.map((r, i) => (
              <RegexCard key={i} pattern={r.pattern} description={r.description} />
            ))}
          </div>

          <h3 className="mt-12 text-[20px] font-semibold tracking-[-0.01em]">
            Rejected → calibrated
          </h3>
          <ul className="mt-4 space-y-4">
            {REJECTED.map((r, i) => (
              <li key={i} className="border-l-2 border-[var(--color-accent-warn)] pl-4">
                <div className="font-[var(--font-mono)] text-[14px] text-[var(--color-accent-warn)]">
                  ✗ {r.phrase}
                </div>
                <div className="mt-1 font-[var(--font-mono)] text-[14px] text-[var(--color-accent)]">
                  ✓ {r.rewrite}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-12 text-[20px] font-semibold tracking-[-0.01em]">
            Try it yourself
          </h3>
          <p className="mt-2 text-[14px] text-[var(--color-fg-muted)] leading-[20px]">
            Type any sentence below. PYTH-GOV runs the calibration sweep
            against it in real time, the same way every output is gated
            before it ships.
          </p>
          <MethodologyTryItYourself />

          <h3 className="mt-12 text-[20px] font-semibold tracking-[-0.01em]">
            Accepted phrasings
          </h3>
          <ul className="mt-4 space-y-2 text-[14px] leading-[20px]">
            {ACCEPTED.map((s, i) => (
              <li key={i} className="text-[var(--color-fg)]">· {s}</li>
            ))}
          </ul>
        </Section>

        <Section number="02" heading="Citation discipline">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            Every prose claim ships with at least one source pointer.
            No quote may exceed 15 words. No source may be quoted
            directly more than once.
          </p>
          <ul className="mt-6 space-y-3 text-[14px] leading-[20px] text-[var(--color-fg)]">
            <li><strong>Tier 1</strong> — Auditor General reports. Highest authority.</li>
            <li><strong>Tier 2</strong> — Departmental Results Reports, Hansard, parliamentary committee evidence.</li>
            <li><strong>Tier 3</strong> — Major-outlet news with editorial review (Globe, La Presse, CBC investigative).</li>
            <li><strong>Tier 4</strong> — Other news. Requires multiple corroborating sources before any claim ships.</li>
          </ul>
        </Section>

        <Section number="03" heading="The Proof token">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            Every output of an accountability AI must itself be accountable.
            The token records what evaluated the input, what model produced
            the analysis, what gates passed, and what audit was issued.
          </p>
          <JsonTypewriter />
        </Section>

        <Section number="04" heading="Structural correspondence with the federal AIA">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            The Pythagorithm Proof token is structurally equivalent to a
            Treasury Board Algorithmic Impact Assessment, applied at every
            output rather than once at deployment.
          </p>
          <AnimatedAiaTable rows={AIA_TABLE} />
        </Section>

        <Section number="05" heading="Data landmines">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            The corpus carries documented defects. Every canonical query
            guards against them explicitly. The Proof token's Tier 1
            records which guards applied.
          </p>
          <ul className="mt-6 space-y-4">
            {LANDMINES.map((l) => (
              <li key={l.id} className="border-l border-[var(--color-border)] pl-4">
                <div className="font-[var(--font-mono)] text-[13px] text-[var(--color-accent-warn)]">
                  {l.id}
                </div>
                <div className="mt-1 text-[14px] text-[var(--color-fg)]">{l.what}</div>
                <div className="mt-2 font-[var(--font-mono)] text-[13px] text-[var(--color-fg-muted)] leading-[20px]">
                  Guard: {l.guard}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="06" heading="The five agents">
          <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
            Each agent operates within bounded perception. The strata are
            not decorative — they are how the architecture is scoped.
          </p>
          <AgentsDiagram />
          <ul className="mt-12 space-y-4">
            {AGENTS.map((a) => (
              <li key={a.id}>
                <div className="font-[var(--font-mono)] text-[13px] text-[var(--color-fg)]">
                  {a.id} · {a.stratum}
                </div>
                <div className="mt-1 text-[14px] text-[var(--color-fg-muted)] leading-[20px]">
                  {a.role}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <RevealSection>
          <footer className="mt-32 border-t border-[var(--color-border-strong)] pt-12 text-center">
            <PythagorithmMark className="w-8 h-8 mx-auto text-[var(--color-accent)]" />
            <p className="mt-6 font-[var(--font-mono)] italic text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Cite as: Pythagorithm Proof Methodology v1.0, retrieved {new Date().toISOString().slice(0, 10)}.
            </p>
          </footer>
        </RevealSection>
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
    <RevealSection>
      <section className="mt-32">
        <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Section {number}
        </div>
        <h2 className="mt-3 text-[clamp(32px,4vw,48px)] tracking-[-0.025em] font-semibold leading-[1.1]">
          {heading}
        </h2>
        <div className="mt-6">{children}</div>
      </section>
    </RevealSection>
  );
}
