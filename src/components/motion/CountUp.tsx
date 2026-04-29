"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up that triggers on viewport entry. Pure JS rAF interpolation
 * with a vanilla IntersectionObserver — no framer-motion. Respects
 * prefers-reduced-motion (renders the final value instantly).
 *
 * History: previously used framer-motion's useInView, which kept an
 * observer alive that could fire after the homepage unmounted (e.g.
 * when the search-bar submit triggered navigation away mid-animation),
 * triggering React removeChild crashes. The vanilla observer disconnects
 * cleanly on unmount and the rAF loop is guarded by a mounted-flag.
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
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(to);
      return;
    }

    let mounted = true;
    let raf = 0;

    const animate = () => {
      const start = performance.now();
      const tick = (now: number) => {
        if (!mounted) return;
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 5);
        setDisplay(eased * to);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (!startOnView) {
      animate();
      return () => {
        mounted = false;
        cancelAnimationFrame(raf);
      };
    }

    if (typeof IntersectionObserver === "undefined") {
      animate();
      return () => {
        mounted = false;
        cancelAnimationFrame(raf);
      };
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            animate();
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "-100px", threshold: 0 },
    );
    obs.observe(node);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [to, durationMs, startOnView]);

  const fmt = format ?? ((n: number) => n.toFixed(decimals));
  return (
    <span ref={ref} className={className}>
      {fmt(display)}
    </span>
  );
}
