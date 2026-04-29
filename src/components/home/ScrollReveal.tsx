"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals its children with a fade-up the first time the element enters
 * the viewport. Uses IntersectionObserver + CSS class toggling instead
 * of framer-motion's whileInView, which raced with route navigation
 * and threw React removeChild errors (Next 15 + React 19 + framer 11).
 *
 * The transition itself is defined by `.scroll-reveal` / `.is-revealed`
 * in globals.css. This component just owns the threshold + once-only
 * behaviour.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
  rootMargin = "-10% 0px -5% 0px",
  threshold = 0.1,
}: {
  children: ReactNode;
  /** Stagger in seconds. */
  delay?: number;
  className?: string;
  rootMargin?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div
      ref={ref}
      className={`scroll-reveal${revealed ? " is-revealed" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
