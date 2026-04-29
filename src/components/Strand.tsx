"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Strand — signature animation. SVG cubic-Bézier from the badge to the
 * source-row panel. Path color shifts to ember on HIGH risk over the second
 * half of the draw.
 *
 * Spec: 600ms total, easing cubic-bezier(0.16, 1, 0.3, 1).
 */
export function Strand({
  from,
  to,
  risk,
  visible,
  onComplete,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  risk: "high" | "low";
  visible: boolean;
  onComplete?: () => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    setLength(total);

    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = `${total}`;
    // Trigger reflow so the transition runs from the dashed-out state
    path.getBoundingClientRect();
    path.style.transition =
      "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms cubic-bezier(0.16, 1, 0.3, 1)";
    path.style.strokeDashoffset = "0";

    const handleEnd = () => {
      onComplete?.();
      path.removeEventListener("transitionend", handleEnd);
    };
    path.addEventListener("transitionend", handleEnd);
    return () => path.removeEventListener("transitionend", handleEnd);
  }, [visible, from.x, from.y, to.x, to.y, onComplete]);

  if (!visible) return null;

  // Cubic-Bézier with control points pulled toward the visual center so the
  // strand "bows inward" — gives the line the quality of a thread drawn taut.
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - 80;
  const d = `M ${from.x} ${from.y} Q ${midX} ${midY}, ${to.x} ${to.y}`;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      width="100%"
      height="100%"
      style={{ position: "fixed" }}
    >
      <path
        ref={pathRef}
        d={d}
        className="strand-path"
        data-risk={risk}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          // The line "breathes" — wider at midpoint via filter
          filter: "drop-shadow(0 0 1px rgba(240,235,226,0.3))",
        }}
      />
      {/* Render length only after measurement so SSR mismatch can't fire */}
      <desc>{length.toFixed(0)}</desc>
    </svg>
  );
}
