"use client";

import type { EvaluationResult } from "@/lib/types";
import { SuitabilityScoreCircle } from "./SuitabilityScoreCircle";
import { SimilarRecordCard } from "./SimilarRecordCard";
import { RecipientConcentrationBar } from "./RecipientConcentrationBar";
import { LanguageAuditView } from "./LanguageAuditView";
import { ProofTokenStrip } from "./ProofTokenStrip";
import { CharStaggerHeadline } from "../motion/CharStaggerHeadline";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function EvaluationView({ result }: { result: EvaluationResult }) {
  const {
    suitability,
    recommendation,
    comparables,
    awardeeConcentration,
    calibrationFlags,
    submission,
    proofToken,
  } = result;
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  const verdictColor =
    suitability.verdict === "PROCEED"
      ? "var(--color-accent)"
      : suitability.verdict === "CONSOLIDATE"
        ? "var(--color-accent-warn)"
        : "var(--color-accent-fail)";

  return (
    <article className="min-h-screen">
      {/* Header strip — atmospheric mesh + char-stagger title + ember rule */}
      <header className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1200px] px-8 pt-24 pb-16">
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ duration: 0.4, ease }}
            className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
          >
            Draft evaluation · {result.evaluationId}
          </motion.div>

          <div className="mt-6">
            <CharStaggerHeadline
              text={submission.workingTitle}
              className="text-[clamp(40px,5vw,64px)] tracking-[-0.03em] font-semibold leading-[1.05]"
              staggerMs={28}
              charDurationMs={500}
              initialDelayMs={120}
            />
          </div>

          {/* Accent rule under title */}
          <motion.div
            initial={reduce ? false : { width: 0 }}
            animate={reduce ? undefined : { width: 80 }}
            transition={{ delay: 0.9, duration: 0.6, ease }}
            className="mt-6 h-px bg-[var(--color-accent)]"
          />

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5, ease }}
            className="mt-6 font-[var(--font-mono)] text-[13px] text-[var(--color-fg-muted)]"
          >
            {submission.awardingDepartment} ·{" "}
            {cad.format(submission.anticipatedAmount)} · FY
            {submission.anticipatedFiscalYear} · submitted{" "}
            {result.createdAt.slice(0, 10)}
          </motion.div>
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-8 space-y-32 py-32">
        {/* Section 1 — Suitability score */}
        <Reveal>
          <SectionLabel number="01">Suitability score</SectionLabel>
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <SuitabilityScoreCircle
              score={suitability}
              explanation={suitability.perComponentExplanation}
            />
            <div>
              <motion.div
                initial={reduce ? false : { opacity: 0, x: -8 }}
                whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 1.2, duration: 0.5, ease }}
                className="inline-block px-4 py-2 rounded-[8px] font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em]"
                style={{
                  backgroundColor: `${verdictColor}1a`,
                  color: verdictColor,
                  border: `1px solid ${verdictColor}40`,
                }}
              >
                {suitability.verdict}
              </motion.div>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 1.4, duration: 0.5, ease }}
                className="mt-6 text-[18px] italic leading-[28px] text-[var(--color-fg)]"
              >
                {recommendation.text}
              </motion.p>
            </div>
          </div>
        </Reveal>

        {/* Section 2 — Similar records */}
        <Reveal>
          <SectionLabel number="02">
            Comparable records found · {comparables.length}
          </SectionLabel>
          <div className="mt-8 max-w-[760px] space-y-4">
            {comparables.slice(0, 8).map((c, i) => (
              <SimilarRecordCard key={c.recordId} record={c} index={i} />
            ))}
          </div>
        </Reveal>

        {/* Section 3 — Recipient concentration */}
        <Reveal>
          <SectionLabel number="03">Recipient pool dynamics</SectionLabel>
          <div className="mt-8 max-w-[840px]">
            <RecipientConcentrationBar concentration={awardeeConcentration} />
          </div>
        </Reveal>

        {/* Section 4 — Language audit */}
        <Reveal>
          <SectionLabel number="04">Calibrated language review</SectionLabel>
          <div className="mt-8 max-w-[840px]">
            <LanguageAuditView
              draftText={submission.draftText}
              flags={calibrationFlags}
            />
          </div>
        </Reveal>

        {/* Section 5 — Proof token */}
        <Reveal>
          <SectionLabel number="05">Audit trail</SectionLabel>
          <div className="mt-8">
            <ProofTokenStrip token={proofToken} />
          </div>
        </Reveal>

        {/* Section 6 — Methodology */}
        <Reveal>
          <section className="border-t border-[var(--color-border)] pt-16">
            <SectionLabel number="06">Methodology</SectionLabel>
            <p className="mt-6 max-w-[760px] text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
              This evaluation was generated under the Pythagorithm Proof
              Methodology v{proofToken.version}. Hybrid retrieval combines
              BM25 with cosine similarity over a curated corpus that
              applies the F-3 amendment-current CTE pattern, A-13
              reversal-pair dedupe, and A-10 roll-up exclusion. Every
              comparable record traces to its source dataset row; every
              score component carries a calibrated explanation; every
              prose claim is gated by the calibrated-language regex set
              before publishing.
            </p>
            <p className="mt-8 font-[var(--font-mono)] italic text-[13px] text-[var(--color-fg-subtle)]">
              Cite as: Pythagorithm Proof Methodology v{proofToken.version},
              evaluation {result.evaluationId}, retrieved{" "}
              {result.createdAt.slice(0, 10)}.
            </p>
          </section>
        </Reveal>

        {/* Methodology footer CTA — new */}
        <Reveal>
          <section className="border-t border-[var(--color-border-strong)] pt-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div>
                <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                  See how this scoring works
                </div>
                <h3 className="mt-4 text-[22px] leading-[30px] tracking-[-0.01em] font-medium">
                  Want to see how this scoring works?
                </h3>
              </div>
              <Link
                href={"/methodology" as never}
                className="group block rounded-[16px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] hover:bg-[var(--color-bg-elev-2)] p-6 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <ShieldCheckGlyph />
                    <div>
                      <div className="text-[var(--text-heading)] font-medium">
                        Read the full methodology
                      </div>
                      <div className="mt-1 text-[14px] text-[var(--color-fg-muted)]">
                        Regex set, citation discipline, AIA correspondence,
                        landmine guards, the agents.
                      </div>
                    </div>
                  </div>
                  <span
                    aria-hidden
                    className="text-[var(--color-accent)] transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </Link>
            </div>
          </section>
        </Reveal>
      </div>
    </article>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease }}
    >
      {children}
    </motion.section>
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
      <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Section {number}
      </div>
      <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] tracking-[-0.02em] font-semibold leading-[1.1]">
        {children}
      </h2>
    </div>
  );
}

function ShieldCheckGlyph() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l8 3v7c0 4.418-3.582 7-8 8-4.418-1-8-3.582-8-8V6l8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
