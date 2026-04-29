"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ProofToken } from "@/lib/types";

const cells = (token: ProofToken) => [
  {
    label: "Input",
    passed: token.tiers.input.passed,
    detail: token.tiers.input.knownDataIssuesRespected.join(", ") || "—",
  },
  {
    label: "Context",
    passed: token.tiers.contextual.passed,
    detail: token.tiers.contextual.model,
  },
  {
    label: "Output",
    passed: token.tiers.output.passed,
    detail: `${token.tiers.output.citationCount} citations · ${token.tiers.output.calibrationCheck}`,
  },
  {
    label: "Audit",
    passed: token.tiers.audit.passed,
    detail: token.tiers.audit.operatorAgent,
  },
];

export function ProofTokenStrip({ token }: { token: ProofToken }) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <div>
      <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Pythagorithm Proof · {token.proofId}
      </div>
      <motion.div
        className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={
          reduce
            ? undefined
            : { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
        }
      >
        {cells(token).map((c) => (
          <motion.div
            key={c.label}
            variants={
              reduce
                ? undefined
                : {
                    hidden: { opacity: 0, y: 8 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease },
                    },
                  }
            }
            className="rounded-[12px] border bg-[var(--color-bg-elev-1)] px-4 py-4"
            style={{
              borderColor: c.passed
                ? "var(--color-accent)"
                : "var(--color-accent-warn)",
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                {c.label}
              </span>
              <span
                className="font-[var(--font-mono)] text-[13px] inline-flex items-center gap-1.5"
                style={{
                  color: c.passed
                    ? "var(--color-accent)"
                    : "var(--color-accent-warn)",
                }}
              >
                <DrawCheck color={c.passed ? "var(--color-accent)" : "var(--color-accent-warn)"} />
                {c.passed ? "passed" : "flagged"}
              </span>
            </div>
            <div className="mt-2 text-[14px] text-[var(--color-fg)] leading-[20px]">
              {c.detail}
            </div>
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-6 flex flex-wrap gap-4 font-[var(--font-mono)] text-[13px]">
        <a
          href={token.downloadUrl ?? `/api/proof/${token.proofId}/download`}
          download
          className="group px-4 py-2 rounded-[8px] border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] transition-colors text-[var(--color-fg)] inline-flex items-center gap-2"
        >
          Download evaluation as JSON
          <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
            ↓
          </span>
        </a>
        <a
          href={token.verifyUrl ?? `/verify/${token.proofId}`}
          className="group px-4 py-2 rounded-[8px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors inline-flex items-center gap-2"
        >
          Verify this evaluation
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </a>
      </div>
    </div>
  );
}

function DrawCheck({ color }: { color: string }) {
  const reduce = useReducedMotion();
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M5 12.5l4 4 10-10"
        initial={{ pathLength: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
