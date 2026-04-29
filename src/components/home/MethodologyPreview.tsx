"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Section F — methodology teaser. Heading, two paragraphs, then a
 * three-card mini-row showing the regex-as-code aesthetic, a flag chip,
 * and a rejected→calibrated pair. Links to /methodology.
 */
export function MethodologyPreview() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <section className="mx-auto max-w-[800px] px-6 py-32">
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease }}
        className="text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-[-0.025em] font-semibold"
      >
        The substance behind the surface.
      </motion.h2>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={
          reduce
            ? undefined
            : { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }
        }
        className="mt-8 space-y-6 text-[16px] leading-[1.55] text-[var(--color-fg-muted)]"
      >
        <motion.p
          variants={
            reduce
              ? undefined
              : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }
          }
        >
          Glassbox runs every output against a published regex set, a
          citation discipline, and a Proof token schema. The validator is
          open. The scoring is reproducible. The audit trail is the product.
        </motion.p>
        <motion.p
          variants={
            reduce
              ? undefined
              : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }
          }
        >
          View the full methodology — including the calibrated lexicon, the
          data landmines, the AIA structural correspondence, and a live
          try-it-yourself validator.
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={
          reduce
            ? undefined
            : { hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }
        }
        className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <MiniCard
          variant="regex"
          label="forbidden_absolute"
          body={`/\\b(fraud|fraudulent|corrupt|illegal)\\b/i`}
        />
        <MiniCard
          variant="flag"
          label="PYTH-GOV"
          body="12 flags"
        />
        <MiniCard
          variant="pair"
          label="rejected → calibrated"
          body=""
        />
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ delay: 0.6, duration: 0.5, ease }}
        className="mt-10"
      >
        <Link
          href={"/methodology" as never}
          className="group inline-flex items-center gap-2 text-[var(--color-accent)] text-[16px] hover:underline-offset-4 hover:underline"
        >
          Read the full methodology
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </motion.div>
    </section>
  );
}

function MiniCard({
  variant,
  label,
  body,
}: {
  variant: "regex" | "flag" | "pair";
  label: string;
  body: string;
}) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <motion.div
      variants={
        reduce
          ? undefined
          : {
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
            }
      }
      className="rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-4 min-h-[112px]"
    >
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      {variant === "regex" && (
        <div className="mt-3 font-[var(--font-mono)] text-[12px] leading-[1.5] text-[var(--color-fg)] break-all">
          {body}
        </div>
      )}
      {variant === "flag" && (
        <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-accent-warn)]/15 border border-[var(--color-accent-warn)]/40 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent-warn)]">
          {body}
        </div>
      )}
      {variant === "pair" && (
        <div className="mt-3 space-y-1.5 font-[var(--font-mono)] text-[11px] leading-[1.5]">
          <div className="text-[var(--color-accent-fail)] line-through decoration-[var(--color-accent-fail)]/60">
            should have
          </div>
          <div className="text-[var(--color-accent)]">
            comparable filings typically state
          </div>
        </div>
      )}
    </motion.div>
  );
}
