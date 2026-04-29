"use client";

import { useEffect, useState } from "react";
import { Brief } from "../Brief";
import type { FindingCard, OutcomeBrief } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Slide-in Brief overlay anchored to the right edge. The Manifold scene
 * dims to 30% behind it (handled at the parent). The overlay holds the
 * Brief surface plus a "Compare to AIA Register" affordance.
 */
export function BriefOverlay({
  finding,
  open,
  onClose,
}: {
  finding: FindingCard;
  open: boolean;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState<OutcomeBrief | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(
      `/api/brief?name=${encodeURIComponent(finding.proofToken.finding.subject.canonicalName)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((b: OutcomeBrief | null) => setBrief(b))
      .finally(() => setLoading(false));
  }, [open, finding]);

  return (
    <aside
      role="dialog"
      aria-label={`Outcome Brief — ${finding.proofToken.finding.subject.canonicalName}`}
      className={cn(
        "fixed inset-y-0 right-0 z-30 w-full max-w-[640px]",
        "border-l border-[var(--color-rule)] bg-[var(--color-ink)]",
        "transform transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        open ? "translate-x-0" : "translate-x-full",
        "overflow-y-auto",
      )}
    >
      <header className="sticky top-0 z-10 flex items-baseline justify-between border-b border-[var(--color-rule)] bg-[var(--color-ink)] px-8 py-4 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[0.12em] text-[var(--color-muted)]">
        <span>Outcome Brief</span>
        <button onClick={onClose} className="hover:text-[var(--color-paper)]">
          ×  Close
        </button>
      </header>

      {loading && (
        <div className="px-8 py-24 text-center font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">
          Resolving brief…
        </div>
      )}
      {!loading && brief && <Brief brief={brief} />}
      {!loading && !brief && (
        <div className="px-8 py-24 text-[var(--text-body)] text-[var(--color-muted)] leading-[1.55]">
          A cached brief is not available for this finding. The synthesis
          pipeline (Bedrock primary, Anthropic API direct as failover) will
          generate one on demand. Until that pass runs, the underlying
          Proof token tells you the structured story.
        </div>
      )}
    </aside>
  );
}
