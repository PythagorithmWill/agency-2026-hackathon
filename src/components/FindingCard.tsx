"use client";

import { useRef } from "react";
import { ProofBadge } from "./ProofBadge";
import {
  CharityGlyph,
  FedGrantGlyph,
  AbGrantGlyph,
  ContractGlyph,
  AIASystemGlyph,
} from "./glyphs";
import type { FindingCard as FindingCardType } from "@/lib/types";
import { cn } from "@/lib/cn";

function GlyphFor({ finding }: { finding: FindingCardType }) {
  const cov = finding.proofToken.finding.subject.datasetCoverage;
  const name = finding.proofToken.finding.subject.canonicalName.toLowerCase();
  const Glyph = name.includes("aia") || name.includes("ai system")
    ? AIASystemGlyph
    : name.includes("shipping") || name.includes("contract")
      ? ContractGlyph
      : cov.includes("ab") && !cov.includes("fed")
        ? AbGrantGlyph
        : cov.includes("cra") && !cov.includes("fed")
          ? CharityGlyph
          : FedGrantGlyph;
  return (
    <Glyph
      className="text-[var(--color-muted)]"
      color="currentColor"
    />
  );
}

/**
 * Findings feed row. NO card background. 1px rule top and bottom is enough.
 * Card backgrounds make the feed look like a SaaS dashboard. The audience
 * reads Auditor General reports for fun — they reward density and restraint.
 */
export function FindingCard({
  finding,
  onSelect,
  selected,
}: {
  finding: FindingCardType;
  onSelect: (proofId: string, badgeRect: DOMRect) => void;
  selected: boolean;
}) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const handleProofClick = () => {
    const el = badgeRef.current;
    if (!el) return;
    onSelect(finding.proofToken.proofId, el.getBoundingClientRect());
  };

  const f = finding.proofToken.finding;
  const isHigh = f.scoreLabel === "HIGH" || f.scoreLabel === "CRITICAL";

  return (
    <article
      data-selected={selected}
      className={cn(
        "relative border-t border-[var(--color-rule)] py-4 pr-1 pl-5",
        "grid grid-cols-[1fr_auto] gap-6 items-baseline transition-colors",
        "hover:bg-[var(--color-vellum)]/40",
        "data-[selected=true]:bg-[var(--color-vellum)]/30",
      )}
    >
      {/* 2px risk-tier left edge */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-4 bottom-4 w-[2px]",
          isHigh
            ? "bg-[var(--color-ember)]"
            : f.scoreLabel === "LOW"
              ? "bg-[var(--color-sage)]"
              : "bg-[var(--color-rule)]",
        )}
      />
      <div>
        <h3 className="font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)] flex items-center gap-3">
          <GlyphFor finding={finding} />
          <span>{f.subject.canonicalName}</span>
        </h3>
        <p className="mt-2 text-[var(--text-body-ui)] text-[var(--color-paper)]">
          {f.summary}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-4 font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)] uppercase tracking-[var(--tracking-wide)]">
          <span>
            BN {f.subject.bnRoot ?? "—"}
          </span>
          <span>{f.subject.datasetCoverage.join(" · ")}</span>
          <span>{finding.indicatorCount}/23 indicators</span>
          <span>updated {finding.lastUpdated.slice(0, 10)}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-4">
        <div className="text-right">
          <div
            className={cn(
              "font-[var(--font-mono)] text-[1.5rem] leading-none",
              isHigh
                ? "text-[var(--color-ember)]"
                : "text-[var(--color-paper)]",
            )}
          >
            {f.score}
          </div>
          <div className="mt-1 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            of 30
          </div>
        </div>
        <div ref={badgeRef}>
          <ProofBadge token={finding.proofToken} onClick={handleProofClick} />
        </div>
      </div>
    </article>
  );
}
