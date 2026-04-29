"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CharStaggerHeadline } from "../motion/CharStaggerHeadline";
import { SearchInput } from "../SearchInput";

/**
 * 100vh hero with character-stagger headline, accent-period terminal char,
 * subtle dual-orb atmosphere drifting in the background, italic dek, and
 * the SearchInput as the focal interaction. Total entrance ~1800ms.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="atmosphere-drift" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-16 md:py-24 text-center">
        <CharStaggerHeadline
          text="Before the money goes out."
          accentLast
          className="text-[clamp(56px,9vw,128px)] leading-[0.95] tracking-[-0.04em] font-semibold"
        />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5, ease }}
          className="mt-12 mx-auto max-w-[720px] text-[24px] leading-[34px] italic text-[var(--color-fg-muted)]"
        >
          Search and evaluate federal contracts and grants before they're
          posted publicly. Surface duplication, concentration, and
          calibration issues during drafting — not after audit.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 1.4, duration: 0.4, ease }}
          className="mt-24"
        >
          <SearchInput />
        </motion.div>
      </div>

      {/* Scroll affordance — subtle "↓" centered at bottom 32px */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 0.6 }}
        transition={{ delay: 1.8, duration: 0.4, ease }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] flex flex-col items-center gap-2 z-10"
      >
        <span>scroll</span>
        <span className="scroll-arrow text-[var(--color-fg-muted)]">↓</span>
      </motion.div>
    </section>
  );
}
