"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CharStaggerHeadline } from "../motion/CharStaggerHeadline";

export function MethodologyHero() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="atmosphere-drift" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1080px] px-4 sm:px-6 py-16 sm:py-24 text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]"
        >
          Methodology
        </motion.div>

        <div className="mt-10">
          <CharStaggerHeadline
            text="The methodology."
            accentLast
            className="text-[clamp(40px,8vw,112px)] leading-[1.05] tracking-[-0.04em] font-semibold"
            staggerMs={32}
            charDurationMs={550}
            initialDelayMs={150}
          />
        </div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5, ease }}
          className="mt-12 mx-auto max-w-[640px] text-[20px] leading-[30px] italic text-[var(--color-fg-muted)]"
        >
          Every check is published. Every regex is open. Every score is
          reproducible.
        </motion.p>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 0.6 }}
        transition={{ delay: 1.4, duration: 0.4, ease }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] flex flex-col items-center gap-2 z-10"
      >
        <span>scroll</span>
        <span className="scroll-arrow text-[var(--color-fg-muted)]">↓</span>
      </motion.div>
    </section>
  );
}
