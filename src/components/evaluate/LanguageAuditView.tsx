"use client";

import { useMemo, useState } from "react";
import type { CalibrationFlag } from "@/lib/types";

/**
 * Inline language audit. Renders the original draft text with forbidden
 * phrases underlined. Hover any flag: floating tooltip with the calibrated
 * rewrite suggestion. "Apply all suggestions" copies the calibrated full
 * draft to clipboard.
 */
export function LanguageAuditView({
  draftText,
  flags,
}: {
  draftText: string;
  flags: CalibrationFlag[];
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const segments = useMemo(() => splitByFlags(draftText, flags), [draftText, flags]);

  const onApplyAll = async () => {
    const rewritten = applyAllRewrites(draftText, flags);
    try {
      await navigator.clipboard.writeText(rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  if (flags.length === 0) {
    return (
      <div className="rounded-[16px] border border-[var(--color-accent)]/30 bg-[var(--color-bg-elev-1)] p-6">
        <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-accent)]">
          PYTH-GOV: passed · 0 calibration flags
        </div>
        <p className="mt-3 text-[var(--text-body)] leading-[24px] text-[var(--color-fg)]">
          The draft text contains no phrases that the calibrated-language
          regex set flags as absolute, causal, or editorial. The text would
          pass the same gate the system applies to its own published output.
        </p>
        <pre className="mt-4 font-[var(--font-sans)] text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)] whitespace-pre-wrap">
          {draftText}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border border-[var(--color-accent-warn)]/30 bg-[var(--color-bg-elev-1)] p-6">
        <div className="flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
          <span className="text-[var(--color-accent-warn)]">
            PYTH-GOV: {flags.length} flag{flags.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onApplyAll}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            {copied ? "Copied →" : "Apply all suggestions ↗"}
          </button>
        </div>
        <p className="mt-4 text-[var(--text-body)] leading-[28px] font-[var(--font-sans)] text-[var(--color-fg)] whitespace-pre-wrap">
          {segments.map((seg, i) =>
            seg.flag ? (
              <span
                key={i}
                className="calibration-flag relative"
                onMouseEnter={() => setHoveredId(i)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {seg.text}
                {hoveredId === i && (
                  <span className="absolute z-20 top-full left-0 mt-2 w-[320px] rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.5)] text-[var(--text-body-sm)] leading-[20px] not-italic font-[var(--font-sans)] no-underline">
                    <span className="block font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-accent-warn)]">
                      {seg.flag.type}
                    </span>
                    <span className="block mt-2 text-[var(--color-fg)]">
                      Match: <span className="text-[var(--color-accent-warn)]">&ldquo;{seg.flag.match}&rdquo;</span>
                    </span>
                    {seg.flag.rewrite && (
                      <span className="block mt-2 text-[var(--color-fg-muted)]">
                        Suggest: {seg.flag.rewrite}
                      </span>
                    )}
                  </span>
                )}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
      </div>

      <p className="text-[var(--text-body-sm)] text-[var(--color-fg-muted)] leading-[20px]">
        {flags.length} flagged phrase{flags.length === 1 ? "" : "s"} found.
        Hover any underlined phrase for the calibrated rewrite. The Auditor
        General's published audits use calibrated alternatives for each.
      </p>
    </div>
  );
}

function splitByFlags(
  text: string,
  flags: CalibrationFlag[],
): { text: string; flag?: CalibrationFlag }[] {
  if (flags.length === 0) return [{ text }];
  const segments: { text: string; flag?: CalibrationFlag }[] = [];
  let cursor = 0;
  for (const f of flags) {
    if (f.start > cursor) segments.push({ text: text.slice(cursor, f.start) });
    segments.push({ text: text.slice(f.start, f.end), flag: f });
    cursor = f.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function applyAllRewrites(text: string, flags: CalibrationFlag[]): string {
  // Apply rewrites in reverse order so indices stay valid
  let out = text;
  for (let i = flags.length - 1; i >= 0; i--) {
    const f = flags[i];
    const replacement = f.rewrite ? `[REVISED: ${f.rewrite}]` : `[FLAGGED: ${f.match}]`;
    out = out.slice(0, f.start) + replacement + out.slice(f.end);
  }
  return out;
}
