"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated digit transition. We render the *new* number, but interpolate
 * from previous → current over 280ms using cubic-bezier ease (manually
 * implemented). No external library — keeps the bundle small.
 */
export function RolledNumber({
  value,
  duration = 280,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // cubic-bezier(0.16, 1, 0.3, 1) approximated via easeOutQuint
      const eased = 1 - Math.pow(1 - t, 5);
      const interp = Math.round(from + (value - from) * eased);
      setDisplay(interp);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
