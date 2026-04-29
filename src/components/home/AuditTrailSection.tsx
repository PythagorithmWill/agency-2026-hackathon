"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const TIERS = ["Input", "Context", "Output", "Audit"] as const;

/**
 * Section D — two-column layout. Left: prose explaining the Proof token.
 * Right: a four-band stylized representation of the token, each band
 * with a sage check that draws its stroke as the section enters view.
 */
export function AuditTrailSection() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <section className="mx-auto max-w-[1200px] px-6 md:px-16 py-32">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
        >
          <h2 className="text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-[-0.025em] font-semibold">
            Every output carries an audit trail.
          </h2>
          <p className="mt-6 text-[18px] leading-[1.55] text-[var(--color-fg-muted)]">
            Pythagorithm Proof tokens wrap every score with full provenance.
            Four governance tiers — input filtering, contextual modeling,
            output gating, audit sealing — each with passing gates,
            evidence count, and retrieval timestamps. Independently
            verifiable. Downloadable as JSON.
          </p>
          <Link
            href={"/methodology" as never}
            className="group mt-8 inline-flex items-center gap-2 text-[var(--color-accent)] text-[16px] hover:underline-offset-4 hover:underline"
          >
            View the methodology
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, x: 16 }}
          whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="relative"
        >
          <ProofTokenStack />
        </motion.div>
      </div>
    </section>
  );
}

function ProofTokenStack() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={
        reduce
          ? undefined
          : { hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }
      }
      className="relative"
    >
      {/* Right-edge connecting line */}
      <div
        aria-hidden
        className="absolute right-3 top-8 bottom-8 w-px bg-[var(--color-accent)]/30"
      />
      <div className="space-y-3">
        {TIERS.map((label) => (
          <motion.div
            key={label}
            variants={
              reduce
                ? undefined
                : {
                    hidden: { opacity: 0, x: 8 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
                  }
            }
            className="rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] h-16 px-6 flex items-center justify-between"
          >
            <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              {label}
            </span>
            <DrawCheck />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function DrawCheck() {
  const reduce = useReducedMotion();
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--color-accent)"
        strokeWidth="1"
        opacity="0.4"
        initial={{ pathLength: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d="M8 12.5l2.5 2.5L16 9"
        initial={{ pathLength: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
