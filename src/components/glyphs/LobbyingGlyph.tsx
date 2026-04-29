/**
 * Lobbying registration — two interlocking paper-clip shapes, suggesting
 * linkage, paperwork, and formality.
 */
export function LobbyingGlyph({
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
      {/* First paperclip */}
      <path d="M9 3v10a3 3 0 0 0 6 0V5a1.5 1.5 0 0 0-3 0v8" />
      {/* Second paperclip — interlocked, rotated, offset */}
      <path d="M5 11v8a3 3 0 0 0 6 0v-8a1.5 1.5 0 0 0-3 0v6" />
    </svg>
  );
}
