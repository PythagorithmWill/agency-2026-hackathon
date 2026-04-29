/**
 * AB grant — Alberta wild rose silhouette (5-petal stylized) inside a
 * document outline.
 */
export function AbGrantGlyph({
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
      {/* Five-petal wild rose: center circle + 5 petals */}
      <circle cx="12" cy="13.5" r="1.1" />
      <path d="M12 9.5l1.5 2.5h-3Z" />
      <path d="M16 12.5l-2.5 1.5v-3Z" />
      <path d="M14.4 17.4L12 16l1.5 2.5Z" />
      <path d="M9.6 17.4L10.5 14.5 12 16Z" />
      <path d="M8 12.5l2.5-1.5v3Z" />
    </svg>
  );
}
