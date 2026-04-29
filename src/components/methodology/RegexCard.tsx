"use client";

import { useState } from "react";

/**
 * Section 01 regex card. Accent border on viewport entry (handled by
 * parent reveal); hover surfaces a tooltip describing what the pattern
 * catches.
 */
export function RegexCard({
  pattern,
  description,
}: {
  pattern: string;
  description: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
      className="relative font-[var(--font-mono)] text-[13px] text-[var(--color-fg)] bg-[var(--color-bg-elev-1)] border border-[var(--color-border)] rounded-[8px] px-4 py-2 break-all transition-colors hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] outline-none"
    >
      {pattern}
      {hovered && (
        <span
          role="tooltip"
          className="absolute z-20 top-full left-0 mt-2 max-w-[420px] rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.5)] text-[13px] leading-[1.5] text-[var(--color-fg)] font-[var(--font-sans)] no-underline"
        >
          {description}
        </span>
      )}
    </div>
  );
}
