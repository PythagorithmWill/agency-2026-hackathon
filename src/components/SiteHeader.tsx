"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { GlassboxWordmark } from "./brand/GlassboxMark";

/**
 * Sticky site header. Transparent over the hero; transitions to bg-elev-1
 * with a 1px border-bottom-strong when scrolled past 80px.
 *
 * Vanilla rAF scroll listener — was framer-motion useScroll/useTransform
 * but motion.header style mutations could collide with React route-change
 * commits and contribute to removeChild crashes. Direct DOM mutation via
 * a ref is deterministic and unmount-safe.
 */
export function SiteHeader() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      node.style.backgroundColor = "rgba(19, 19, 19, 0.92)";
      node.style.borderBottomColor = "rgba(255, 255, 255, 0.12)";
      node.style.backdropFilter = "blur(8px)";
      (node.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter =
        "blur(8px)";
      return;
    }

    let pending = false;
    let frame = 0;

    const apply = () => {
      pending = false;
      const y = Math.min(window.scrollY, 80);
      const t = y / 80;
      const bgAlpha = 0.92 * t;
      const borderAlpha = 0.12 * t;
      const blurPx = (8 * t).toFixed(2);
      node.style.backgroundColor = `rgba(19, 19, 19, ${bgAlpha.toFixed(3)})`;
      node.style.borderBottomColor = `rgba(255, 255, 255, ${borderAlpha.toFixed(3)})`;
      node.style.backdropFilter = `blur(${blurPx}px)`;
      (node.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter =
        `blur(${blurPx}px)`;
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
    <header
      ref={ref}
      className="fixed top-0 left-0 right-0 z-30 border-b no-print"
      style={{
        backgroundColor: "rgba(19, 19, 19, 0)",
        borderBottomColor: "rgba(255, 255, 255, 0)",
        backdropFilter: "blur(0px)",
        WebkitBackdropFilter: "blur(0px)",
      }}
    >
      <div className="mx-auto max-w-[1440px] h-20 px-6 md:px-8 flex items-center justify-between">
        <Link
          href={"/" as never}
          className="flex items-center group"
          onClick={() => {
            // If we're already on the homepage Next.js doesn't re-render,
            // so the natural "go home" gesture would be a no-op. Always
            // scroll to top so the click does something visible.
            if (typeof window !== "undefined" && window.location.pathname === "/") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <GlassboxWordmark
            size={30}
            className="text-[var(--color-fg)] group-hover:opacity-90 transition-opacity"
          />
        </Link>
        <nav className="flex items-center gap-6 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
          <Link
            href={"/follow" as never}
            className="hover:text-[var(--color-fg)] transition-colors"
          >
            Follow the money
          </Link>
          <Link
            href={"/transparency" as never}
            className="hover:text-[var(--color-fg)] transition-colors"
          >
            Transparency
          </Link>
          <Link
            href={"/methodology" as never}
            className="hover:text-[var(--color-fg)] transition-colors"
          >
            Methodology
          </Link>
          <Link
            href={"/search" as never}
            className="hover:text-[var(--color-fg)] transition-colors"
          >
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
    </header>
  );
}
