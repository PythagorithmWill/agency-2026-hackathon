"use client";

import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { GlassboxWordmark } from "../brand/GlassboxMark";
import { SearchInput } from "../SearchInput";

/**
 * Hero. The Glassbox wordmark sits on top of a full-bleed photograph of
 * the box. Three parallax layers driven by scrollY:
 *   1. Background image — drifts down ~22% of scroll distance (slowest)
 *   2. Dark gradient overlay — deepens to bg colour as user scrolls
 *   3. Foreground (wordmark + subhead + search) — drifts up + fades
 *
 * Only `useScroll` + `useTransform` hooks — no mount/unmount animations,
 * because the prior `motion.div` enter animations raced with route
 * navigation and triggered React removeChild crashes (Next 15 + React 19).
 * Scroll-derived MotionValues stay attached for the lifetime of the node.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  const bgY = useTransform(scrollY, [0, 800], ["0%", "22%"]);
  const bgScale = useTransform(scrollY, [0, 800], [1.05, 1.15]);
  const overlayOpacity = useTransform(scrollY, [0, 600], [0.55, 0.95]);
  const contentY = useTransform(scrollY, [0, 600], [0, -120]);
  const contentOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background image — slowest parallax layer */}
      <motion.div
        aria-hidden
        className="absolute inset-0 z-0"
        style={reduce ? undefined : { y: bgY, scale: bgScale }}
      >
        <Image
          src="/glassbox-hero.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>

      {/* Dark gradient overlay — deepens on scroll */}
      <motion.div
        aria-hidden
        className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/30 to-[var(--color-bg)]"
        style={reduce ? undefined : { opacity: overlayOpacity }}
      />

      {/* Atmospheric drift accents */}
      <div className="atmosphere-drift z-[2]" aria-hidden />

      {/* Foreground — pulled up & fades as user scrolls */}
      <motion.div
        className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pt-24 pb-12 text-center"
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <div
          className="flex justify-center"
          style={{ animation: "glassbox-fade-up 0.7s ease-out both" }}
        >
          <GlassboxWordmark
            size={140}
            animateDraw
            className="text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div
          className="mt-12"
          style={{ animation: "glassbox-fade-up 0.5s ease-out 0.5s both" }}
        >
          <SearchInput />
        </div>
      </motion.div>

      {/* Scroll affordance */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-white/75 flex flex-col items-center gap-2 z-10"
        style={{ animation: "glassbox-fade-up 0.4s ease-out 1.3s both" }}
      >
        <span>scroll</span>
        <span className="scroll-arrow text-white/85">↓</span>
      </div>
    </section>
  );
}
