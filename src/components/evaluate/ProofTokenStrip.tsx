import type { ProofToken } from "@/lib/types";

const cells = (token: ProofToken) => [
  {
    label: "Input",
    passed: token.tiers.input.passed,
    detail: token.tiers.input.knownDataIssuesRespected.join(", ") || "—",
  },
  {
    label: "Context",
    passed: token.tiers.contextual.passed,
    detail: token.tiers.contextual.model,
  },
  {
    label: "Output",
    passed: token.tiers.output.passed,
    detail: `${token.tiers.output.citationCount} citations · ${token.tiers.output.calibrationCheck}`,
  },
  {
    label: "Audit",
    passed: token.tiers.audit.passed,
    detail: token.tiers.audit.operatorAgent,
  },
];

export function ProofTokenStrip({ token }: { token: ProofToken }) {
  return (
    <div>
      <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Pythagorithm Proof · {token.proofId}
      </div>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cells(token).map((c) => (
          <div
            key={c.label}
            className="rounded-[12px] border bg-[var(--color-bg-elev-1)] px-4 py-4"
            style={{
              borderColor: c.passed ? "var(--color-accent)" : "var(--color-accent-warn)",
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                {c.label}
              </span>
              <span
                className="font-[var(--font-mono)] text-[var(--text-mono)]"
                style={{
                  color: c.passed ? "var(--color-accent)" : "var(--color-accent-warn)",
                }}
              >
                {c.passed ? "passed" : "flagged"}
              </span>
            </div>
            <div className="mt-2 text-[var(--text-body-sm)] text-[var(--color-fg)] leading-[20px]">
              {c.detail}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-4 font-[var(--font-mono)] text-[var(--text-mono)]">
        <a
          href={token.downloadUrl ?? `/api/proof/${token.proofId}/download`}
          download
          className="px-4 py-2 rounded-[8px] border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] transition-colors text-[var(--color-fg)]"
        >
          Download evaluation as JSON ↓
        </a>
        <a
          href={token.verifyUrl ?? `/verify/${token.proofId}`}
          className="px-4 py-2 rounded-[8px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Verify this evaluation →
        </a>
      </div>
    </div>
  );
}
