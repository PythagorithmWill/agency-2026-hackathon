import type { ProofToken } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Bottom-of-Brief Proof token strip. Four pills, one per tier, showing
 * the gate state. Pure typography — no shadow, no fill, just border.
 */
export function ProofTokenStrip({ token }: { token: ProofToken }) {
  const tiers = [
    { label: "Input", passed: token.tiers.input.passed, detail: token.tiers.input.knownDataIssuesRespected.join(", ") || "—" },
    { label: "Context", passed: token.tiers.contextual.passed, detail: token.tiers.contextual.model },
    { label: "Output", passed: token.tiers.output.passed, detail: `${token.tiers.output.citationCount} citations · calibration ${token.tiers.output.calibrationCheck}` },
    { label: "Audit", passed: token.tiers.audit.passed, detail: token.tiers.audit.operatorAgent },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
        Pythagorithm Proof · {token.proofId}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.label}
            className={cn(
              "border px-4 py-3 rounded-[6px] font-[var(--font-mono)] text-[var(--text-mono)]",
              t.passed
                ? "border-[var(--color-sage)] text-[var(--color-paper)]"
                : "border-[var(--color-ember)] text-[var(--color-paper)]",
            )}
          >
            <div className="flex items-baseline justify-between text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)]">
              <span className="text-[var(--color-muted)]">{t.label}</span>
              <span
                className={
                  t.passed
                    ? "text-[var(--color-sage)]"
                    : "text-[var(--color-ember)]"
                }
              >
                {t.passed ? "✓" : "✗"}
              </span>
            </div>
            <div className="mt-1 text-[var(--text-small)] text-[var(--color-paper)]">
              {t.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
