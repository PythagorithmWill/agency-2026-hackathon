import { notFound } from "next/navigation";
import Link from "next/link";
import { findProofTokenById } from "@/lib/proofRegistry";
import { proofTokenCompleteness, type Violation } from "@/lib/gov/validators";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  const { proofId } = await params;
  const decoded = decodeURIComponent(proofId);
  const found = findProofTokenById(decoded);
  if (!found) notFound();

  const violations: Violation[] = proofTokenCompleteness(found.token);
  const verifiedAt = new Date().toISOString();
  const passed = violations.length === 0;
  const tierGates = [
    { label: "Input (Tier 1)", passed: found.token.tiers.input.passed, detail: `Filters: ${found.token.tiers.input.filtersApplied.join(", ")}` },
    { label: "Context (Tier 2)", passed: found.token.tiers.contextual.passed, detail: `Model: ${found.token.tiers.contextual.model} · prompt ${found.token.tiers.contextual.promptVersion}` },
    { label: "Output (Tier 3)", passed: found.token.tiers.output.passed, detail: `${found.token.tiers.output.citationCount} citations · max-quote ${found.token.tiers.output.quoteWordCountMax} words · calibration ${found.token.tiers.output.calibrationCheck}` },
    { label: "Audit (Tier 4)", passed: found.token.tiers.audit.passed, detail: `Operator ${found.token.tiers.audit.operatorAgent}; ${found.token.tiers.audit.previousTokenHash ? "chained" : "unchained"}` },
  ];

  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Link href={"/" as never} className="hover:text-[var(--color-fg)]">
          ← Pythagorithm
        </Link>
        <Link href={"/methodology" as never} className="hover:text-[var(--color-fg)]">
          Methodology
        </Link>
      </header>

      <article className="mx-auto max-w-[760px] px-6 py-16">
        <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Verify Proof token
        </div>
        <h1 className="mt-6 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] font-semibold leading-[52px]">
          {found.subjectName}
        </h1>
        <div className="mt-4 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)] break-all">
          {decoded}
        </div>

        <section className="mt-12 rounded-[16px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-8">
          <div className="flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            <span>Verification result</span>
            <span>{verifiedAt.slice(0, 19)}Z</span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span
              className="font-[var(--font-display)] text-[40px] leading-none font-semibold"
              style={{ color: passed ? "var(--color-accent)" : "var(--color-accent-warn)" }}
            >
              {passed ? "PASSED" : "FAILED"}
            </span>
            <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)]">
              {violations.length} violation{violations.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] font-semibold leading-[36px]">
            Tier-by-tier
          </h2>
          <ul className="mt-6 space-y-4">
            {tierGates.map((g) => (
              <li key={g.label} className="rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg)]">
                    {g.label}
                  </span>
                  <span
                    className="font-[var(--font-mono)] text-[var(--text-mono)]"
                    style={{ color: g.passed ? "var(--color-accent)" : "var(--color-accent-warn)" }}
                  >
                    {g.passed ? "passed" : "flagged"}
                  </span>
                </div>
                <div className="mt-2 text-[var(--text-body-sm)] text-[var(--color-fg-muted)] leading-[20px]">
                  {g.detail}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {violations.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] font-semibold leading-[36px]">
              Violations
            </h2>
            <ul className="mt-6 space-y-3">
              {violations.map((v, i) => (
                <li key={i} className="border-l-2 border-[var(--color-accent-warn)] pl-4">
                  <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-accent-warn)]">
                    {v.type}
                  </div>
                  <div className="mt-1 text-[var(--text-body-sm)] text-[var(--color-fg)]">
                    {v.detail}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16 font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] leading-[1.6]">
          Validator version: PYTH-GOV v1.0 · Methodology: Pythagorithm Proof v{found.token.version}
        </section>

        <section className="mt-12 flex gap-6 font-[var(--font-mono)] text-[var(--text-mono)]">
          <a
            href={`/api/proof/${found.token.proofId}/download`}
            download
            className="hover:text-[var(--color-fg)] underline-offset-2 hover:underline text-[var(--color-fg-muted)]"
          >
            Download token (JSON) ↓
          </a>
        </section>
      </article>
    </main>
  );
}
