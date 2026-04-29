/**
 * AIA-registered AI system — cube with a small inspection-glass loupe
 * overlapping its corner. Communicates "system under examination."
 */
export function AIASystemGlyph({
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
      {/* Isometric cube */}
      <path d="M4 8l6-3 6 3-6 3Z" />
      <path d="M4 8v8l6 3v-8" />
      <path d="M16 8v8l-6 3" />
      {/* Loupe overlapping upper-right */}
      <circle cx="17.5" cy="6.5" r="2.5" />
      <path d="M19.4 8.4l1.6 1.6" />
    </svg>
  );
}
