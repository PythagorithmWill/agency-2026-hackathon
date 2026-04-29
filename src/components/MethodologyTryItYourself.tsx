"use client";

import { useState } from "react";
import { calibrationFlags } from "@/lib/gov/validators";

export function MethodologyTryItYourself() {
  const [text, setText] = useState("");
  const flags = calibrationFlags(text);
  const empty = text.trim() === "";
  const status = empty
    ? { label: "PYTH-GOV idle — type a sentence", color: "var(--color-fg-subtle)" }
    : flags.length === 0
      ? { label: "PYTH-GOV: passed · 0 violations", color: "var(--color-accent)" }
      : { label: `PYTH-GOV: ${flags.length} violation${flags.length === 1 ? "" : "s"}`, color: "var(--color-accent-warn)" };

  return (
    <div className="mt-6">
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
