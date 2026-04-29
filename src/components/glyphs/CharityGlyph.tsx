/**
 * Charity — small building outline with a heart shape integrated into the
 * door. 24×24 viewBox, 1.5px stroke, currentColor.
 */
export function CharityGlyph({
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
      {/* Building footprint */}
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-5h6v5" />
      {/* Heart on door */}
      <path d="M12 14.2c-.6-.7-1.7-1.2-2.4-.4-.7.7-.4 1.9.4 2.5l2 1.5 2-1.5c.8-.6 1.1-1.8.4-2.5-.7-.8-1.8-.3-2.4.4Z" />
    </svg>
  );
}
