/**
 * Pythagorithm signature mark — geometric construction. A right triangle
 * inscribed in a circle (the Pythagorean reference), with a small filled
 * dot at the right angle indicating the operating point. Used in the
 * Manifold center, Brief Proof token strip, and as the favicon.
 */
export function PythagorithmMark({
  className,
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Circle */}
      <circle cx="12" cy="12" r="9" />
      {/* Right triangle inscribed: hypotenuse from 3-o-clock to 9-o-clock,
          right angle at bottom (6 o'clock direction) */}
      <path d="M3.5 12 L20.5 12 L12 20.5 Z" />
      {/* Filled dot at the right angle */}
      <circle cx="12" cy="20.5" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}
