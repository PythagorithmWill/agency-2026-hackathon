"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

const FULL = `{
  "proofId":   "ppm-2026-04-29T...-abc123",
  "version":   "1.0",
  "issuedAt":  "...",
  "issuedBy":  "PYTH-LEAD",
  "finding":   { type, summary, subject, score, scoreLabel },
  "evidence":  [{ source, rowId, field, value, asOf }, ...],
  "tiers": {
    "input":     { passed, filtersApplied, knownDataIssuesRespected },
    "contextual":{ passed, model, promptHash, promptVersion, temperature },
    "output":    { passed, calibrationCheck, citationCount, quoteWordCountMax },
    "audit":     { passed, tokenHash, previousTokenHash, operatorAgent, logRef }
  },
  "disclaimers": [
    "Data current as of ...",
    "Entity resolution is probabilistic for cross-dataset matches without BN anchor",
    "These are observations from public records. They are not findings of misconduct."
  ]
}`;

/**
 * Section 03 typewriter. When the block enters view, it renders
 * character-by-character at ~8ms per character (~3 seconds total).
 * prefers-reduced-motion: jumps straight to the full text.
 */
export function JsonTypewriter() {
  const ref = useRef<HTMLPreElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? FULL : "");

  useEffect(() => {
    if (reduce) return;
    if (!inView) return;
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(FULL.length, i + 4);
      setShown(FULL.slice(0, i));
      if (i >= FULL.length) clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <pre
      ref={ref}
      className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 font-[var(--font-mono)] text-[13px] leading-relaxed text-[var(--color-fg)] whitespace-pre-wrap min-h-[420px]"
    >
      {shown}
      {!reduce && shown.length < FULL.length && (
        <span className="inline-block w-[7px] h-[14px] align-baseline ml-0.5 bg-[var(--color-accent)] animate-pulse" />
      )}
    </pre>
  );
}
