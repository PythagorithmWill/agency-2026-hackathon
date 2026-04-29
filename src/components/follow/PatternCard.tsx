"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { PatternDef } from "@/lib/patterns/registry";
import { PatternStatusPill } from "./PatternStatusPill";

interface Props {
  pattern: PatternDef;
  /** Optional live match-count badge (rendered as "{n} records match"). */
  matchCount?: number | null;
  /** Animation index for staggered reveal. */
  index?: number;
}

/**
 * The shared pattern card used on the homepage Follow-the-Money grid
 * and on /follow. Shows pattern name, calibrated definition, technical
 * detection signal, status pill, optional match count, TRACE
 * attribution line where applicable.
 *
 * Click → /follow/{id}.
 */
export function PatternCard({ pattern, matchCount, index = 0 }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/follow/${pattern.id}` as never}
        className="group block h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 hover:border-[var(--color-border-strong)] transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[18px] tracking-tight leading-snug">{pattern.name}</h3>
          <PatternStatusPill status={pattern.status} />
        </div>
        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
          {pattern.definition}
        </p>
        <div className="mt-4 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
          Signal · {pattern.signal}
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-3 pt-4 border-t border-[var(--color-border)]">
          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            {matchCount != null
              ? `${matchCount.toLocaleString("en-CA")} records match`
              : pattern.status === "coming"
                ? "Detector pending"
                : "Run detector for matches"}
          </div>
          <span
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors"
            aria-hidden
          >
            ▸
          </span>
        </div>
        {pattern.attribution === "TRACE" && (
          <div className="mt-3 font-[var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] leading-snug">
            Pattern based on Alberta TRACE methodology
          </div>
        )}
      </Link>
    </motion.div>
  );
}
