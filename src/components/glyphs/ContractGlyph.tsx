/**
 * Contract — document outline with a wax-seal circle in the corner.
 */
export function ContractGlyph({
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
      {/* Document frame */}
      <path d="M4 3h11l3 3v15H4Z" />
      <path d="M15 3v3h3" />
      {/* Body lines */}
      <path d="M7 10h7" />
      <path d="M7 13h7" />
      {/* Wax seal in lower-right corner */}
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="M15.6 16.1l2.8 2.8" />
      <path d="M18.4 16.1l-2.8 2.8" />
    </svg>
  );
}
