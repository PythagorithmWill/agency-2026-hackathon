"use client";

import { useState } from "react";
import { calibrationFlags } from "@/lib/gov/validators";

const TRY_EXAMPLES = [
  "This program clearly shows fraud and proves the recipients should have been audited.",
  "The dataset shows 31 amendments to this contribution agreement.",
  "AI is obviously the future and will fix everything.",
];

export function MethodologyTryItYourself() {
  const [text, setText] = useState("");
  const flags = calibrationFlags(text);
  const empty = text.trim() === "";
  const status = empty
    ? { label: "PYTH-GOV idle — type a sentence", color: "var(--color-fg-subtle)" }
    : flags.length === 0
      ? { label: "PYTH-GOV: passed · 0 calibration flags", color: "var(--color-accent)" }
      : { label: `PYTH-GOV: ${flags.length} calibration flag${flags.length === 1 ? "" : "s"}`, color: "var(--color-accent-warn)" };

  return (
    <div className="mt-6">
      <p className="mb-3 text-[13.5px] leading-[1.55] text-[var(--color-fg-muted)]">
        Type any sentence — the calibration sweep runs <em>live</em> as you type.
        No submit button, no API call. Try one of the seeded examples below to
        see how PYTH-GOV catches uncalibrated language (causal claims, hedging
        absent, directives, &ldquo;clearly shows&rdquo;, and so on).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. The dataset shows 31 amendments to the contribution agreement."
        className="w-full px-4 py-3 rounded-[8px] border bg-transparent text-[var(--text-body)] focus:outline-none transition-colors placeholder:italic placeholder:text-[var(--color-fg-subtle)]"
        style={{ borderColor: empty ? "var(--color-border-strong)" : status.color }}
      />
      <div
        className="mt-3 font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em]"
        style={{ color: status.color }}
      >
        {status.label}
        {empty && (
          <span className="block mt-1 normal-case tracking-normal text-[12px] text-[var(--color-fg-muted)]">
            (Status updates with every keystroke — try an example below.)
          </span>
        )}
        {!empty && flags.length === 0 && (
          <span className="block mt-1 normal-case tracking-normal text-[12px] text-[var(--color-fg-muted)]">
            Your sentence reads as calibrated — no causal claims, no
            uncalibrated absolutes, no directives. Want to see flags fire?
            Try a seeded example below.
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-2">
          Seeded examples — click to load
        </div>
        <ul className="flex flex-col gap-2">
          {TRY_EXAMPLES.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setText(s)}
                className="text-left text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                &ldquo;{s}&rdquo;
              </button>
            </li>
          ))}
        </ul>
      </div>
      {flags.length > 0 && (
        <ul className="mt-3 space-y-2">
          {flags.map((f, i) => (
            <li key={i} className="rounded-[8px] border border-[var(--color-accent-warn)]/40 bg-[var(--color-bg-elev-1)] px-4 py-3">
              <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-accent-warn)]">
                {f.type}
              </div>
              <div className="mt-1 text-[var(--text-body-sm)] text-[var(--color-fg)]">
                Match: <span className="text-[var(--color-accent-warn)]">&ldquo;{f.match}&rdquo;</span>
              </div>
              {f.rewrite && (
                <div className="mt-1 text-[var(--text-body-sm)] text-[var(--color-fg-muted)]">
                  Suggest: {f.rewrite}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
