"use client";

import { useState } from "react";

/**
 * Truncated text with an inline "Show full / Show less" toggle. Renders the
 * truncated form on the server so the initial paint is compact; the full
 * text is always in the DOM for copy/search once expanded.
 */
export function ExpandableText({
  text,
  clamp = 120,
  className = "",
}: {
  text: string | null | undefined;
  clamp?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const full = (text ?? "").trim();
  if (!full) return <span className={className}>—</span>;
  const needsClamp = full.length > clamp;
  const shown = open || !needsClamp ? full : `${full.slice(0, clamp).trimEnd()}…`;
  return (
    <span className={className}>
      <span className={open ? "whitespace-pre-wrap break-words" : undefined}>{shown}</span>
      {needsClamp && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline align-baseline"
        >
          {open ? "Show less" : "Show full"}
        </button>
      )}
    </span>
  );
}
