/**
 * Federal grant — maple leaf inside a document outline. The frame is
 * essential; without it, it's just a maple leaf.
 */
export function FedGrantGlyph({
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
      <path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0V3Z" />
      <path d="M16 3v3h3" />
      {/* Stylized maple leaf */}
      <path d="M12 9.5l1.2 2.4 2.6-.4-1.4 2.2 1.6 1.7-2.4.5-.4 2.6-1.2-1.5-1.2 1.5-.4-2.6-2.4-.5 1.6-1.7-1.4-2.2 2.6.4Z" />
    </svg>
  );
}
