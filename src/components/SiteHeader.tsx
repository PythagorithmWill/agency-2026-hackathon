"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { GlassboxMark, GlassboxWordmark } from "./brand/GlassboxMark";

/**
 * Sticky site header. Transparent over the hero; transitions to bg-elev-1
 * with a 1px border-bottom-strong when scrolled past 80px. Uses Framer
 * Motion's useScroll/useTransform — no scroll listener boilerplate.
 *
 * Used on every page. Header height: 64px.
 */
export function SiteHeader() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const bg = useTransform(
    scrollY,
    [0, 80],
    ["rgba(19, 19, 19, 0)", "rgba(19, 19, 19, 0.92)"],
  );
  const borderColor = useTransform(
    scrollY,
    [0, 80],
    ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.12)"],
  );
  const backdrop = useTransform(scrollY, [0, 80], ["blur(0px)", "blur(8px)"]);

  return (
    <motion.header
      style={
        reduce
          ? undefined
          : {
              backgroundColor: bg,
              borderBottomColor: borderColor,
              backdropFilter: backdrop,
              WebkitBackdropFilter: backdrop,
            }
      }
      className="fixed top-0 left-0 right-0 z-30 border-b no-print"
    >
      <div className="mx-auto max-w-[1440px] h-20 px-6 md:px-8 flex items-center justify-between">
        <Link href={"/" as never} className="flex items-center gap-4 group">
          <GlassboxMark size={42} className="text-[var(--color-fg)]" />
          <GlassboxWordmark size={30} className="text-[var(--color-fg)] group-hover:opacity-90 transition-opacity" />
        </Link>
        <nav className="flex items-center gap-6 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
          <Link href={"/methodology" as never} className="hover:text-[var(--color-fg)] transition-colors">
            Methodology
          </Link>
          <Link href={"/search" as never} className="hover:text-[var(--color-fg)] transition-colors">
            Search
          </Link>
          <Link
            href={"/evaluate" as never}
            className="px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            Evaluate
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
