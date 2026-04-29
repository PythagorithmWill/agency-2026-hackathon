"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Count-up that triggers on viewport entry. Pure JS rAF interpolation
 * (no library), cubic-bezier(0.16, 1, 0.3, 1) approximated as easeOutQuint.
 * Respects prefers-reduced-motion — renders the final value instantly.
 */
export function CountUp({
  to,
  durationMs = 1500,
  startOnView = true,
  format,
  className,
  decimals = 0,
}: {
  to: number;
  durationMs?: number;
  startOnView?: boolean;
  format?: (n: number) => string;
  className?: string;
  decimals?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [display, setDisplay] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(to);
      return;
    }
    if (startOnView && !inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplay(eased * to);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, startOnView, inView, reduce]);

  const fmt = format ?? ((n: number) => n.toFixed(decimals));
  return (
    <span ref={ref} className={className}>
      {fmt(display)}
    </span>
  );
}
