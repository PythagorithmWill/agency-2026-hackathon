import type { EvaluationResult } from "@/lib/types";
import { SuitabilityScoreCircle } from "./SuitabilityScoreCircle";
import { SimilarRecordCard } from "./SimilarRecordCard";
import { RecipientConcentrationBar } from "./RecipientConcentrationBar";
import { LanguageAuditView } from "./LanguageAuditView";
import { ProofTokenStrip } from "./ProofTokenStrip";
import Link from "next/link";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function EvaluationView({ result }: { result: EvaluationResult }) {
  const { suitability, recommendation, comparables, awardeeConcentration, calibrationFlags, submission, proofToken } = result;

  const verdictColor =
    suitability.verdict === "PROCEED"
      ? "var(--color-accent)"
      : suitability.verdict === "CONSOLIDATE"
        ? "var(--color-accent-warn)"
        : "var(--color-accent-fail)";

  return (
    <article className="min-h-screen">
      {/* Header strip */}
      <header className="atmosphere-mesh border-b border-[var(--color-border-strong)]">
        <div className="mx-auto max-w-[1200px] px-8 pt-24 pb-16">
          <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Draft evaluation · {result.evaluationId}
          </div>
          <h1 className="mt-4 text-[var(--text-display-lg)] tracking-[var(--tracking-display-lg)] font-semibold leading-[68px]">
            {submission.workingTitle}
          </h1>
          <div className="mt-4 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)]">
            {submission.awardingDepartment} ·{" "}
            {cad.format(submission.anticipatedAmount)} ·{" "}
            FY{submission.anticipatedFiscalYear} ·{" "}
            submitted {result.createdAt.slice(0, 10)}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-8 space-y-32 py-32">
        {/* Section 1 — Suitability score */}
        <section>
          <SectionLabel number="01">Suitability score</SectionLabel>
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <SuitabilityScoreCircle
              score={suitability}
              explanation={suitability.perComponentExplanation}
            />
            <div>
              <div
                className="inline-block px-4 py-2 rounded-[8px] font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em]"
                style={{
                  backgroundColor: `${verdictColor}1a`,
                  color: verdictColor,
                  border: `1px solid ${verdictColor}40`,
                }}
              >
                {suitability.verdict}
              </div>
              <p className="mt-6 text-[var(--text-body-lg)] italic leading-[28px] text-[var(--color-fg)]">
                {recommendation.text}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 — Similar records */}
        <section>
          <SectionLabel number="02">
            Comparable records found · {comparables.length}
          </SectionLabel>
          <div className="mt-8 max-w-[760px] space-y-4">
            {comparables.slice(0, 8).map((c, i) => (
              <SimilarRecordCard key={c.recordId} record={c} index={i} />
            ))}
          </div>
        </section>

        {/* Section 3 — Recipient concentration */}
        <section>
          <SectionLabel number="03">Recipient pool dynamics</SectionLabel>
          <div className="mt-8 max-w-[840px]">
            <RecipientConcentrationBar concentration={awardeeConcentration} />
          </div>
        </section>

        {/* Section 4 — Language audit */}
        <section>
          <SectionLabel number="04">Calibrated language review</SectionLabel>
          <div className="mt-8 max-w-[840px]">
            <LanguageAuditView
              draftText={submission.draftText}
              flags={calibrationFlags}
            />
          </div>
        </section>

        {/* Section 5 — Proof token */}
        <section>
          <SectionLabel number="05">Audit trail</SectionLabel>
          <div className="mt-8">
            <ProofTokenStrip token={proofToken} />
          </div>
        </section>

        {/* Section 6 — Methodology footer */}
        <section className="border-t border-[var(--color-border)] pt-16">
          <SectionLabel number="06">Methodology</SectionLabel>
          <p className="mt-6 max-w-[760px] text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)]">
            This evaluation was generated under the Pythagorithm Proof
            Methodology v{proofToken.version}. Hybrid retrieval combines
            BM25 with cosine similarity over a curated corpus that
            applies the F-3 amendment-current CTE pattern, A-13 reversal-pair
            dedupe, and A-10 roll-up exclusion. Every comparable record
            traces to its source dataset row; every score component carries
            a calibrated explanation; every prose claim is gated by the
            calibrated-language regex set before publishing. See{" "}
            <Link href={"/methodology" as never} className="text-[var(--color-accent)] hover:underline-offset-2 hover:underline">
              the methodology page
            </Link>
            {" "}for the canonical schema, the validator, and the AIA
            structural correspondence.
          </p>
          <p className="mt-8 font-[var(--font-mono)] italic text-[var(--text-mono)] text-[var(--color-fg-subtle)]">
            Cite as: Pythagorithm Proof Methodology v{proofToken.version},
            evaluation {result.evaluationId}, retrieved{" "}
            {result.createdAt.slice(0, 10)}.
          </p>
        </section>
      </div>
    </article>
  );
}

function SectionLabel({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Section {number}
      </div>
      <h2 className="mt-3 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] font-semibold leading-[36px]">
        {children}
      </h2>
    </div>
  );
}
