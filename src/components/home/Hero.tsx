import Image from "next/image";
import { GlassboxWordmark } from "../brand/GlassboxMark";
import { SearchInput } from "../SearchInput";

/**
 * Hero. The Glassbox wordmark is the headline; the literal glass-box
 * photograph is the dominant visual. Subhead and search input sit below.
 *
 * Image: public/glassbox-hero.jpeg — photograph of a glass cube
 * containing a network graph with money flows leaving the box.
 *
 * No framer-motion here — the in-flight animations were racing with
 * route navigation away from the homepage and triggering React
 * removeChild crashes (Next 15 + React 19 + framer 11). Reveal is
 * driven by CSS keyframes (`glassbox-fade-up`) which are
 * deterministic and don't observe the DOM.
 */
export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="atmosphere-drift" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pt-24 pb-12 text-center">
        {/* Wordmark — the new "headline" */}
        <div
          className="flex justify-center"
          style={{ animation: "glassbox-fade-up 0.6s ease-out both" }}
        >
          <GlassboxWordmark size={96} className="text-[var(--color-fg)]" />
        </div>

        {/* Hero image — the prominent feature */}
        <div
          className="relative mt-10 mx-auto w-full max-w-[1100px]"
          style={{ animation: "glassbox-fade-up 0.8s ease-out 0.2s both" }}
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-[var(--color-bg)]/50"
            />
          </div>
        </div>

        {/* Subhead */}
        <p
          className="mt-12 mx-auto max-w-[820px] text-[24px] leading-[34px] italic text-[var(--color-fg-muted)]"
          style={{ animation: "glassbox-fade-up 0.5s ease-out 0.7s both" }}
        >
          Follow the money — federal grants, Alberta contracts, charity flows,
          sole-source amendments — across millions of records, in calibrated
          language, with full citation.
        </p>

        {/* Search */}
        <div
          className="mt-12"
          style={{ animation: "glassbox-fade-up 0.4s ease-out 1.0s both" }}
        >
          <SearchInput />
        </div>
      </div>

      {/* Scroll affordance */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] flex flex-col items-center gap-2 z-10"
        style={{ animation: "glassbox-fade-up 0.4s ease-out 1.4s both" }}
      >
        <span>scroll</span>
        <span className="scroll-arrow text-[var(--color-fg-muted)]">↓</span>
      </div>
    </section>
  );
}
