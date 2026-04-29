/**
 * Animated maple-leaf loader. Renders the same /maple-leaf.png asset
 * the hero uses, with a pulsing red rim-light filter — the leaf body
 * stays invisible (brightness(0)), and the surrounding red drop-shadow
 * breathes from soft to bright and back over ~1.6s. On-brand with the
 * hero rim-light treatment.
 *
 * Optional caption renders below in mono caps.
 */
export function MapleLeafLoader({
  size = 96,
  caption,
}: {
  size?: number;
  caption?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div
        className="maple-loader"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/maple-leaf.png"
          alt=""
          className="maple-loader__leaf"
        />
      </div>
      {caption && (
        <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
          {caption}
        </div>
      )}
    </div>
  );
}
