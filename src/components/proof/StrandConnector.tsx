"use client";

/**
 * SVG strand drawn between parent and child Proof token panels. Uses a
 * cubic-Bézier with control points pulled toward the visual center for the
 * "thread drawn taut" feel. Stroke shifts to ember if `risk` is high.
 */
export function StrandConnector({
  risk,
  className,
}: {
  risk: "high" | "low";
  className?: string;
}) {
  // Hard-coded geometry: the connector spans the gap between the two
  // panels at fixed positions. The parent path goes from x=0 to x=100,
  // bowing slightly upward at the midpoint.
  const d = "M 0 24 Q 50 0 100 24";
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 48"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d={d}
        fill="none"
        stroke={
          risk === "high" ? "var(--color-ember)" : "var(--color-paper)"
        }
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity="0.85"
      >
        <animate
          attributeName="stroke-dasharray"
          from="120 120"
          to="120 0"
          dur="700ms"
          fill="freeze"
        />
      </path>
    </svg>
  );
}
