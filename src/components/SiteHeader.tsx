"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile menu is open; close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  const navLinks: Array<{ href: string; label: string; tourId?: string; pill?: boolean }> = [
    { href: "/follow", label: "Follow the money", tourId: "tour-nav-follow" },
    { href: "/recommendations", label: "Recommendations", tourId: "tour-nav-recommendations" },
    { href: "/transparency", label: "Transparency", tourId: "tour-nav-transparency" },
    { href: "/methodology", label: "Methodology", tourId: "tour-nav-methodology" },
    { href: "/search", label: "Search" },
    { href: "/evaluate", label: "Evaluate", pill: true },
  ];

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
      <div className="mx-auto max-w-[1440px] h-20 px-4 sm:px-6 md:px-8 flex items-center justify-between">
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

        {/* Desktop nav — unchanged at md+. */}
        <nav className="hidden md:flex items-center gap-6 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
          {navLinks.map((link) =>
            link.pill ? (
              <Link
                key={link.href}
                href={link.href as never}
                data-tour-id={link.tourId}
                className="px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <Link
                key={link.href}
                href={link.href as never}
                data-tour-id={link.tourId}
                className="hover:text-[var(--color-fg)] transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        {/* Mobile hamburger — only renders below md. */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-md text-[var(--color-fg)] hover:bg-white/5 transition-colors"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="13" x2="20" y2="13" />
                <line x1="4" y1="19" x2="20" y2="19" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu — drops below the header on small screens only. */}
      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
          menuOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{
          backgroundColor: "rgba(19, 19, 19, 0.96)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: menuOpen ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
        aria-hidden={!menuOpen}
      >
        <nav className="px-4 sm:px-6 py-4 flex flex-col gap-1 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href as never}
              data-tour-id={link.tourId}
              className={
                link.pill
                  ? "mt-2 inline-flex items-center justify-center px-3 py-2.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  : "py-2.5 hover:text-[var(--color-fg)] transition-colors"
              }
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
