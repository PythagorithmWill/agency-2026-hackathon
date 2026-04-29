"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { GlassboxWordmark } from "../brand/GlassboxMark";
import { SearchInput } from "../SearchInput";

/**
 * Hero. Glassbox wordmark over a full-bleed photograph of the box, with a
 * three-layer parallax driven by a single requestAnimationFrame scroll
 * listener:
 *   1. Background image — drifts down ~22% of scroll distance (slowest)
 *   2. Dark gradient overlay — deepens to bg colour as user scrolls
 *   3. Foreground (wordmark + search) — drifts up + fades
 *
 * Direct DOM mutation via refs, NOT framer-motion. Earlier versions used
 * framer-motion's `useScroll`/`useTransform` — those motion.div elements
 * raced with route navigation and triggered React removeChild crashes
 * on the homepage's commit-mutation phase. The vanilla rAF loop has no
 * framer-motion bridge to fail on unmount.
 *
 * Honors prefers-reduced-motion: we attach the listener but emit the
 * static end-state values (no movement).
 */
export function Hero() {
  const bgRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let frame = 0;
    let pending = false;

    const apply = () => {
      pending = false;
      const y = window.scrollY;

      // Same curves as the prior framer-motion version.
      const bgY = Math.min(y, 800) * 0.22;
      const bgScale = 1.05 + Math.min(y, 800) / 800 * 0.10;
      const overlayOpacity = 0.55 + Math.min(y, 600) / 600 * 0.40;
      const contentY = -Math.min(y, 600) * 0.20;
      const contentOpacity = Math.max(0, 1 - y / 500);

      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${bgY}px, 0) scale(${bgScale.toFixed(3)})`;
      }
      if (overlayRef.current) {
        overlayRef.current.style.opacity = overlayOpacity.toFixed(3);
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${contentY.toFixed(1)}px, 0)`;
        contentRef.current.style.opacity = contentOpacity.toFixed(3);
      }
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background image — slowest parallax layer */}
      <div
        ref={bgRef}
        aria-hidden
        className="absolute inset-0 z-0 will-change-transform"
        style={{ transform: "translate3d(0, 0, 0) scale(1.05)" }}
      >
        <Image
          src="/glassbox-hero.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Dark gradient overlay — deepens on scroll */}
      <div
        ref={overlayRef}
        aria-hidden
        className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/30 to-[var(--color-bg)] will-change-[opacity]"
        style={{ opacity: 0.55 }}
      />

      {/* Atmospheric drift accents */}
      <div className="atmosphere-drift z-[2]" aria-hidden />

      {/* Foreground — pulled up & fades as user scrolls */}
      <div
        ref={contentRef}
        className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pt-24 pb-12 text-center will-change-transform"
        style={{ transform: "translate3d(0, 0, 0)", opacity: 1 }}
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
      </div>

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
