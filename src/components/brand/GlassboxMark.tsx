/**
 * Glassbox brand mark — a 32×32 square frame with three horizontal hairlines
 * inside (suggesting strata visible THROUGH the box) and a single accent dot
 * at the centre crossing of the middle hairline. The dot is the focal point
 * — the "lens" of the glass box. It tracks the accent colour so it changes
 * meaning per surface.
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
      <rect x="3" y="3" width="26" height="26" rx="2" />
      <line x1="6" y1="11" x2="26" y2="11" stroke={color} strokeWidth="1" opacity="0.45" />
      <line x1="6" y1="16" x2="26" y2="16" stroke={color} strokeWidth="1" opacity="0.45" />
      <line x1="6" y1="21" x2="26" y2="21" stroke={color} strokeWidth="1" opacity="0.45" />
      <circle cx="16" cy="16" r="1.6" fill={accent} stroke="none" />
    </svg>
  );
}

/**
 * The "glassbox" wordmark. Lowercase Inter 600. The "o" in "box" is rendered
 * as a 3D wireframe cube (isometric outline, paper-coloured), the visual
 * signal for transparency. The cube replaces the prior lens-circle treatment.
 *
 * `size` is the typographic em-height in px; the cube scales proportionally
 * to align to the baseline.
 */
export function GlassboxWordmark({
  className,
  size = 30,
}: {
  className?: string;
  size?: number;
}) {
  // Cube viewport ≈ same em as a lowercase "o" plus a small overshoot for
  // the back face. We render an isometric wireframe with three visible faces.
  const cubeSize = size * 0.78;

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
      }}
    >
      {/* "glassb" */}
      <span>glassb</span>
      {/* "o" → 3D wireframe cube */}
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: `${cubeSize}px`,
          height: `${cubeSize}px`,
          margin: `0 ${size * 0.04}px ${-size * 0.06}px`,
          position: "relative",
        }}
      >
        <CubeWireframe size={cubeSize} />
      </span>
      {/* "x" */}
      <span>x</span>
    </span>
  );
}

/**
 * Isometric wireframe cube. Three visible faces (front, top, right) drawn
 * as a single SVG path so the strokes share corners cleanly. Stroke matches
 * `currentColor` so the wordmark colour governs.
 */
function CubeWireframe({ size }: { size: number }) {
  // Build a 100-unit isometric cube and let the SVG scale to `size`.
  // Front face: a square offset from the back-top.
  // Top face: rhombus from the back-top back-right.
  // Right face: rhombus from the front-right to the back-right.
  //
  // Coordinates chosen so the cube fits 0..100 with equal margins.
  //
  //          ─── back-top ───
  //         /                 \
  //        /                   \
  //   front-top ──────── right-top
  //       │                │
  //       │   front face   │
  //       │                │
  //   front-bot ──────── right-bot
  const stroke = 7; // SVG stroke is 7 of 100 — visually balances with Inter weight
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="cube"
    >
      {/* Front face square */}
      <path d="M 18 38 L 18 88 L 68 88 L 68 38 Z" />
      {/* Top face rhombus */}
      <path d="M 18 38 L 38 18 L 88 18 L 68 38" />
      {/* Right face rhombus */}
      <path d="M 68 38 L 88 18 L 88 68 L 68 88" />
      {/* Hidden edges — drawn at lower opacity so the cube reads as 3-D
          rather than as a flat hexagon. */}
      <g stroke="currentColor" strokeWidth={stroke * 0.7} opacity="0.35">
        <path d="M 18 38 L 38 18" />
        <path d="M 38 18 L 38 68 L 18 88" strokeDasharray="3 4" />
        <path d="M 38 68 L 88 68" strokeDasharray="3 4" />
      </g>
    </svg>
  );
}
