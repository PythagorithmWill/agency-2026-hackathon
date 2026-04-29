/**
 * Canadian maple leaf silhouette — the 11-point flag standard. Used as
 * a subtle right-side accent on the homepage hero alongside the glass-box
 * photograph, signalling the federal-and-Alberta-Canadian remit.
 *
 * Path is the canonical 11-point geometry from the Government of Canada
 * flag specification, normalized to a 0..200 viewBox with the stem at
 * the bottom (y=200).
 */
export function MapleLeaf({
  className,
  fill = "#D52B1E",
  opacity = 1,
}: {
  className?: string;
  fill?: string;
  opacity?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
      fill={fill}
      style={{ opacity }}
      aria-hidden="true"
    >
      <path
        d="
          M 100 8
          L 108 38
          L 138 33
          L 128 58
          L 158 60
          L 132 78
          L 168 88
          L 138 100
          L 150 122
          L 120 116
          L 116 142
          L 100 130
          L 84 142
          L 80 116
          L 50 122
          L 62 100
          L 32 88
          L 68 78
          L 42 60
          L 72 58
          L 62 33
          L 92 38
          Z
          M 96 130
          L 96 192
          L 104 192
          L 104 130
          Z
        "
      />
    </svg>
  );
}
