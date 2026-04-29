/**
 * Glassbox brand mark — a 32x32 square frame with three horizontal hairlines
 * inside (suggesting strata visible THROUGH the box) and a single accent dot
 * at the centre crossing of the middle hairline.
 *
 * The dot is the focal point — the "lens" of the glass box. It tracks the
 * accent colour so it changes meaning per surface (sage on default,
 * accent-warn on warning states).
 */
export function GlassboxMark({
  className,
  color = "currentColor",
  accent = "var(--color-accent)",
  size = 32,
}: {
  className?: string;
  color?: string;
  accent?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer square frame */}
      <rect x="3" y="3" width="26" height="26" rx="2" />
      {/* Three internal hairlines: 25%, 50%, 75% */}
      <line x1="6" y1="11" x2="26" y2="11" stroke={color} strokeWidth="1" opacity="0.45" />
      <line x1="6" y1="16" x2="26" y2="16" stroke={color} strokeWidth="1" opacity="0.45" />
      <line x1="6" y1="21" x2="26" y2="21" stroke={color} strokeWidth="1" opacity="0.45" />
      {/* Accent dot at the centre of the middle hairline */}
      <circle cx="16" cy="16" r="1.6" fill={accent} stroke="none" />
    </svg>
  );
}

/**
 * The "glassbox" wordmark as a React component. The "o" is a perfect circle
 * outline (1.5px stroke, --color-accent) — a tiny visual signal of the
 * lens / transparency metaphor.
 */
export function GlassboxWordmark({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  // Render five letters + the lens-circle "o" + two letters as inline-flex
  // so the circle aligns to the typographic baseline.
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        fontSize: `${size}px`,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
        gap: "0",
      }}
    >
      <span>glassb</span>
      <span
        style={{
          display: "inline-block",
          width: `${size * 0.55}px`,
          height: `${size * 0.55}px`,
          margin: `0 ${size * 0.04}px ${-size * 0.02}px`,
          borderRadius: "50%",
          border: `1.5px solid var(--color-accent)`,
          boxSizing: "border-box",
        }}
        aria-hidden
      />
      <span>x</span>
    </span>
  );
}
