"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

export type NumberFormat = "currency-compact" | "currency-full" | "number" | "percent";

interface Props {
  value: number;
  format?: NumberFormat;
  durationMs?: number;
  className?: string;
  /** When true, animates count-up on first scroll-into-view; when false, prints final value immediately. */
  animate?: boolean;
}

const FORMATTERS: Record<NumberFormat, (n: number) => string> = {
  "currency-compact": (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  },
  "currency-full": (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n),
  number: (n) => Math.round(n).toLocaleString("en-CA"),
  percent: (n) => `${(n * 100).toFixed(1)}%`,
};

/**
 * Counts up from 0 to `value` once on first scroll-into-view. Honors
 * prefers-reduced-motion (renders the final value instantly).
 *
 * Format is a string key (not a function) so this client component can
 * be safely consumed by server components.
 */
export function AnimatedNumber({
  value,
  format = "number",
  durationMs = 900,
  className = "",
  animate = true,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [display, setDisplay] = useState<number>(reduce || !animate ? value : 0);

  useEffect(() => {
    if (!inView || reduce || !animate) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce, animate, durationMs]);

  const fmt = FORMATTERS[format];
  return (
    <motion.span ref={ref} className={className}>
      {fmt(display)}
    </motion.span>
  );
}
