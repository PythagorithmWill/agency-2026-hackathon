"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { GlassboxWordmark } from "../brand/GlassboxMark";
import { SearchInput } from "../SearchInput";

/**
 * Hero. The Glassbox wordmark is the headline; the literal glass-box
 * photograph is the dominant visual. Subhead and search input sit below.
 *
 * Image: public/glassbox-hero.jpeg — 2752×1536 photograph of a glass
 * cube containing a network graph with money flows leaving the box.
 * Used here at clamp() responsive sizing.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="atmosphere-drift" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pt-24 pb-12 text-center">
        {/* Wordmark — the new "headline" */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex justify-center"
        >
          <GlassboxWordmark
            size={96}
            className="text-[var(--color-fg)]"
          />
        </motion.div>

        {/* Hero image — the prominent feature */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease }}
          className="relative mt-10 mx-auto w-full max-w-[1100px]"
        >
          <div className="relative rounded-xl overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] shadow-[0_30px_120px_-20px_rgba(94,234,212,0.18),0_10px_40px_-10px_rgba(0,0,0,0.6)]">
            <Image
              src="/glassbox-hero.jpeg"
              alt="A glass box on a plinth, containing a network of nodes with money flows visible passing through and exiting the box."
              width={2752}
              height={1536}
              priority
              sizes="(max-width: 1100px) 100vw, 1100px"
              className="block w-full h-auto"
            />
            {/* Subtle bottom gradient to anchor the image to the page */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-[var(--color-bg)]/50"
            />
          </div>
        </motion.div>

        {/* Subhead */}
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease }}
          className="mt-12 mx-auto max-w-[820px] text-[24px] leading-[34px] italic text-[var(--color-fg-muted)]"
        >
          Follow the money — federal grants, Alberta contracts, charity flows,
          sole-source amendments — across millions of records, in calibrated
          language, with full citation.
        </motion.p>

        {/* Search */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.4, ease }}
          className="mt-12"
        >
          <SearchInput />
        </motion.div>
      </div>

      {/* Scroll affordance */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 0.6 }}
        transition={{ delay: 1.4, duration: 0.4, ease }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] flex flex-col items-center gap-2 z-10"
      >
        <span>scroll</span>
        <span className="scroll-arrow text-[var(--color-fg-muted)]">↓</span>
      </motion.div>
    </section>
  );
}
