/**
 * Donation — upward arrow that becomes a hand at the top.
 */
export function DonationGlyph({
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
      {/* Arrow shaft */}
      <path d="M12 21V11" />
      {/* Arrow shoulders becoming a stylized open hand */}
      <path d="M9 14l3-3 3 3" />
      <path d="M9.5 9.5V6.5" />
      <path d="M12 9V5" />
      <path d="M14.5 9.5V6.5" />
      <path d="M9.5 6.5a1 1 0 0 1 5 0" />
    </svg>
  );
}
