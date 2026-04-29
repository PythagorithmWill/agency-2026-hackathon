import { notFound } from "next/navigation";
import { ProofHeader } from "@/components/ProofHeader";
import { findProofTokenById } from "@/lib/proofRegistry";
import { proofTokenCompleteness, type Violation } from "@/lib/gov/validators";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  const { proofId } = await params;
  const decoded = decodeURIComponent(proofId);
  const found = await findProofTokenById(decoded);
  if (!found) notFound();

  const violations: Violation[] = proofTokenCompleteness(found.token);
  const verifiedAt = new Date().toISOString();
  const passed = violations.length === 0;
  const tierGates: { label: string; passed: boolean; detail: string }[] = [
    { label: "Input (Tier 1)", passed: found.token.tiers.input.passed, detail: `Filters: ${found.token.tiers.input.filtersApplied.join(", ")}` },
    { label: "Context (Tier 2)", passed: found.token.tiers.contextual.passed, detail: `Model: ${found.token.tiers.contextual.model} · prompt ${found.token.tiers.contextual.promptVersion}` },
    { label: "Output (Tier 3)", passed: found.token.tiers.output.passed, detail: `${found.token.tiers.output.citationCount} citations · max-quote ${found.token.tiers.output.quoteWordCountMax} words · calibration ${found.token.tiers.output.calibrationCheck}` },
    { label: "Audit (Tier 4)", passed: found.token.tiers.audit.passed, detail: `Operator ${found.token.tiers.audit.operatorAgent}; ${found.token.tiers.audit.previousTokenHash ? "chained" : "unchained"}` },
  ];

  return (
    <>
      <ProofHeader />
      <main className="mx-auto max-w-[760px] px-8 py-16">
        <header>
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Verify Proof token
          </div>
          <h1 className="mt-6 font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)] leading-[1.05]">
            {found.subjectName}
          </h1>
          <div className="mt-4 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)] break-all">
            {decoded}
          </div>
        </header>

        <section className="mt-12 border border-[var(--color-rule)] rounded-[8px] p-8">
          <div className="flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            <span>Verification result</span>
            <span>{verifiedAt.slice(0, 19)}Z</span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span
              className={
                "font-[var(--font-mono)] text-[2.5rem] leading-none " +
                (passed ? "text-[var(--color-sage)]" : "text-[var(--color-ember)]")
              }
            >
              {passed ? "PASSED" : "FAILED"}
            </span>
            <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">
              {violations.length} violation{violations.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Tier-by-tier
          </h2>
          <ul className="mt-6 space-y-4">
            {tierGates.map((g) => (
              <li key={g.label} className="border border-[var(--color-rule)] rounded-[6px] px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)]">
                    {g.label}
                  </span>
                  <span
                    className={
                      "font-[var(--font-mono)] text-[var(--text-mono)] " +
                      (g.passed ? "text-[var(--color-sage)]" : "text-[var(--color-ember)]")
                    }
                  >
                    {g.passed ? "passed" : "failed"}
                  </span>
                </div>
                <div className="mt-2 text-[var(--text-small)] text-[var(--color-muted)] leading-[1.5]">
                  {g.detail}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {violations.length > 0 && (
          <section className="mt-12">
            <h2 className="font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
              Violations
            </h2>
            <ul className="mt-6 space-y-3">
              {violations.map((v, i) => (
                <li key={i} className="border-l-2 border-[var(--color-ember)] pl-4">
                  <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-ember)]">
                    {v.type}
                  </div>
                  <div className="mt-1 text-[var(--text-small)] text-[var(--color-paper)]">
                    {v.detail}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)] leading-[1.6]">
          Validator version: PYTH-GOV v1.0 · Methodology: Pythagorithm Proof v{found.token.version}
        </section>

        <section className="mt-12 flex gap-6 font-[var(--font-mono)] text-[var(--text-small)]">
          <a href={`/proof/${found.token.proofId}`} className="hover:text-[var(--color-paper)] underline-offset-2 hover:underline text-[var(--color-muted)]">
            View token →
          </a>
          <a href={`/api/proof/${found.token.proofId}/download`} download className="hover:text-[var(--color-paper)] underline-offset-2 hover:underline text-[var(--color-muted)]">
            Download token (JSON) ↗
          </a>
        </section>
      </main>
    </>
  );
}
