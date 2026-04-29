"use client";

import { useState } from "react";
import { calibrationSweep } from "@/lib/gov/validators";

/**
 * Live PYTH-GOV validator. Type any sentence; the calibration sweep runs
 * on every keystroke. Each violation surfaces as an ember-bordered chip
 * with the rewrite suggestion below.
 */
export function MethodologyTryItYourself() {
  const [text, setText] = useState("");
  const violations = calibrationSweep(text);
  const empty = text.trim() === "";
  return (
    <div className="mt-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. The dataset shows 31 amendments to the contribution agreement."
        className={`w-full border bg-transparent px-4 py-3 font-[var(--font-sans)] text-[var(--text-body-ui)] rounded-[6px] focus:outline-none ${
          empty
            ? "border-[var(--color-rule)] focus:border-[var(--color-paper)]"
            : violations.length === 0
              ? "border-[var(--color-sage)]"
              : "border-[var(--color-ember)]"
        }`}
      />
      <div className="mt-3 min-h-[2rem] font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)]">
        {empty && <span className="text-[var(--color-muted)]">PYTH-GOV idle — type a sentence</span>}
        {!empty && violations.length === 0 && (
          <span className="text-[var(--color-sage)]">PYTH-GOV: passed · 0 violations</span>
        )}
        {!empty && violations.length > 0 && (
          <span className="text-[var(--color-ember)]">PYTH-GOV: {violations.length} violation{violations.length > 1 ? "s" : ""}</span>
        )}
      </div>
      {violations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {violations.map((v, i) => (
            <li key={i} className="border border-[var(--color-ember)] rounded-[6px] px-3 py-2">
              <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-ember)]">
                {v.type}
              </div>
              <div className="mt-1 text-[var(--text-small)] text-[var(--color-paper)]">
                Match: <span className="text-[var(--color-ember)]">&ldquo;{v.match}&rdquo;</span>
              </div>
              {v.rewrite && (
                <div className="mt-1 text-[var(--text-small)] text-[var(--color-muted)] leading-[1.5]">
                  Suggest: {v.rewrite}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
