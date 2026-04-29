"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import type { ProofToken } from "@/lib/types";

/**
 * Slide-in panel anchored to the right side. Renders the four tiers as
 * separate sections with sage/ember icons. Plain typography — no card stack,
 * no shadow, no glassmorphism.
 */
export function ProofDrawer({
  token,
  open,
  onClose,
}: {
  token: ProofToken | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!token) return null;

  return (
    <aside
      role="complementary"
      aria-label="Pythagorithm Proof token detail"
      className={cn(
        "fixed inset-y-0 right-0 z-40 w-full max-w-[480px]",
        "border-l border-[var(--color-rule)] bg-[var(--color-vellum)]",
        "transform transition-transform duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] px-8 py-6">
        <div>
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Pythagorithm Proof
          </div>
          <div className="mt-1 font-[var(--font-mono)] text-[var(--text-small)]">
            {token.proofId}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-muted)] hover:text-[var(--color-paper)]"
        >
          Close (Esc)
        </button>
      </header>

      <div className="space-y-8 px-8 py-8 overflow-y-auto h-[calc(100vh-7rem)]">
        <section>
          <SectionLabel>Finding</SectionLabel>
          <p className="mt-2 font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)] leading-[1.25]">
            {token.finding.summary}
          </p>
          <div className="mt-4 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">
            Score {token.finding.score}
            {token.finding.scoreScale !== "category" &&
              token.finding.scoreScale !== "dollars" &&
              ` (${token.finding.scoreScale})`}
            {" · "}
            <span
              className={
                token.finding.scoreLabel === "HIGH" ||
                token.finding.scoreLabel === "CRITICAL"
                  ? "text-[var(--color-ember)]"
                  : "text-[var(--color-sage)]"
              }
            >
              {token.finding.scoreLabel}
            </span>
          </div>
        </section>

        <section>
          <SectionLabel>Evidence ({token.evidence.length} records)</SectionLabel>
          <ul className="mt-3 space-y-2">
            {token.evidence.map((ev, i) => (
              <li
                key={i}
                className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)]"
              >
                <span className="text-[var(--color-muted)]">·</span> {ev.source}
                {ev.field && (
                  <span className="text-[var(--color-muted)]">.{ev.field}</span>
                )}
                {" → "}
                <span>{formatValue(ev.value)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionLabel>Governance trace</SectionLabel>
          <ul className="mt-3 space-y-3 font-[var(--font-mono)] text-[var(--text-mono)]">
            <TierRow
              passed={token.tiers.input.passed}
              label="Input"
              detail={token.tiers.input.filtersApplied.join(" · ")}
              tag={
                token.tiers.input.knownDataIssuesRespected.length > 0
                  ? `Respects ${token.tiers.input.knownDataIssuesRespected.join(", ")}`
                  : undefined
              }
            />
            <TierRow
              passed={token.tiers.contextual.passed}
              label="Context"
              detail={`${token.tiers.contextual.model} · T=${token.tiers.contextual.temperature}`}
              tag={`prompt: ${token.tiers.contextual.promptVersion}`}
            />
            <TierRow
              passed={token.tiers.output.passed}
              label="Output"
              detail={`${token.tiers.output.citationCount} citations · max-quote ${token.tiers.output.quoteWordCountMax} words`}
              tag={`calibration: ${token.tiers.output.calibrationCheck}`}
            />
            <TierRow
              passed={token.tiers.audit.passed}
              label="Audit"
              detail={`operator: ${token.tiers.audit.operatorAgent}`}
              tag={
                token.tiers.audit.previousTokenHash
                  ? `chained from ${token.tiers.audit.previousTokenHash.slice(0, 14)}`
                  : "unchained"
              }
            />
          </ul>
        </section>

        <section>
          <SectionLabel>Disclaimers</SectionLabel>
          <ul className="mt-3 space-y-2 text-[var(--text-small)] text-[var(--color-muted)]">
            {token.disclaimers.map((d, i) => (
              <li key={i}>· {d}</li>
            ))}
          </ul>
        </section>

        <footer className="flex gap-4 border-t border-[var(--color-rule)] pt-6">
          <a
            href={token.rerunUrl}
            className="border border-[var(--color-rule)] px-4 py-2 text-[var(--text-small)] hover:border-[var(--color-paper)]"
          >
            Re-run with adjusted weights
          </a>
          <a
            href={`/api/proof/${token.proofId}.json`}
            className="text-[var(--text-small)] text-[var(--color-muted)] hover:text-[var(--color-paper)]"
          >
            Download token (JSON)
          </a>
        </footer>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-[var(--font-sans)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
      {children}
    </div>
  );
}

function TierRow({
  passed,
  label,
  detail,
  tag,
}: {
  passed: boolean;
  label: string;
  detail: string;
  tag?: string;
}) {
  return (
    <li className="grid grid-cols-[16px_1fr] items-baseline gap-2">
      <span
        aria-label={passed ? "passed" : "failed"}
        className={
          passed
            ? "text-[var(--color-sage)]"
            : "text-[var(--color-ember)]"
        }
      >
        {passed ? "✓" : "✗"}
      </span>
      <div>
        <div>
          <span className="text-[var(--color-paper)]">{label}</span>
          <span className="ml-3 text-[var(--color-muted)]">{detail}</span>
        </div>
        {tag && <div className="text-[var(--color-muted)]">{tag}</div>}
      </div>
    </li>
  );
}

function formatValue(v: string | number | null): string {
  if (v === null) return "(null)";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1000) {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(v);
    }
    return v.toString();
  }
  return v;
}
