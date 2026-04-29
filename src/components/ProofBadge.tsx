"use client";

import { cn } from "@/lib/cn";
import type { ProofToken } from "@/lib/types";

/**
 * The badge sits in the top-right corner of every finding card. Sage when all
 * four tier gates pass; ember when any tier fails or the score crosses HIGH.
 *
 * No "AI" word, no Sparkles icon, no shimmer. The badge is a typographic mark.
 */
export function ProofBadge({
  token,
  onClick,
  className,
}: {
  token: ProofToken;
  onClick?: () => void;
  className?: string;
}) {
  const allPassed =
    token.tiers.input.passed &&
    token.tiers.contextual.passed &&
    token.tiers.output.passed &&
    token.tiers.audit.passed;

  const isHigh =
    token.finding.scoreLabel === "HIGH" || token.finding.scoreLabel === "CRITICAL";

  const state: "sage" | "ember" = allPassed && !isHigh ? "sage" : "ember";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Pythagorithm Proof — ${token.finding.scoreLabel}, click to inspect`}
      className={cn(
        "group inline-flex items-center gap-2 border px-3 py-1.5",
        "rounded-[6px] font-[var(--font-mono)] text-[var(--text-micro)]",
        "uppercase tracking-[var(--tracking-wide)] transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        state === "sage" &&
          "border-[var(--color-sage)] text-[var(--color-sage)] hover:bg-[var(--color-sage-soft)]/10",
        state === "ember" &&
          "border-[var(--color-ember)] text-[var(--color-ember)] hover:bg-[var(--color-ember-soft)]/10",
        className,
      )}
      data-state={state}
      data-proof-id={token.proofId}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "sage" && "bg-[var(--color-sage)]",
          state === "ember" && "bg-[var(--color-ember)]",
        )}
      />
      <span>Proof</span>
      <span className="text-[var(--color-muted)]">·</span>
      <span>{token.finding.scoreLabel}</span>
    </button>
  );
}
