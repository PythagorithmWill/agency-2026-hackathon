import { notFound } from "next/navigation";
import { ProofHeader } from "@/components/ProofHeader";
import { findProofTokenById } from "@/lib/proofRegistry";
import { decodeWeights, recalculateScore, scoreLabel } from "@/lib/proofChain";
import { ProofTokenStrip } from "@/components/ProofTokenStrip";

/**
 * Permalink for an inspected Proof token. If query parameters describe a
 * chain (parent + weights + reason), we render the chained variant
 * alongside the original. Otherwise we render the primary token detail.
 */
export default async function ProofPermalink({
  params,
  searchParams,
}: {
  params: Promise<{ proofId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { proofId } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(proofId);

  // Either this is a base proofId from cached findings/briefs, or a
  // chained proofId that points back to a parent via the `parent` param.
  const parentParam = typeof sp.parent === "string" ? sp.parent : null;
  const lookupId = parentParam ?? decoded;
  const found = await findProofTokenById(lookupId);
  if (!found) notFound();

  const weightsParam = typeof sp.w === "string" ? sp.w : null;
  const reasonParam = typeof sp.reason === "string" ? sp.reason : null;
  const isChained = parentParam !== null;
  const weights = decodeWeights(weightsParam);
  const newScore = isChained
    ? recalculateScore(found.token.finding.score, weights)
    : found.token.finding.score;
  const newLabel = isChained
    ? scoreLabel(newScore)
    : (found.token.finding.scoreLabel as string);

  return (
    <>
      <ProofHeader />
      <main className="mx-auto max-w-[952px] px-8 py-16">
        <header>
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Pythagorithm Proof {isChained ? "— chained token" : "— permalink"}
          </div>
          <h1 className="mt-4 font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)] leading-[1.05]">
            {found.subjectName}
          </h1>
          <div className="mt-6 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)] break-all">
            {decoded}
          </div>
        </header>

        <section className="mt-12 grid grid-cols-2 gap-6 max-w-[480px]">
          <div className="border border-[var(--color-rule)] rounded-[8px] p-5">
            <div className="text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
              Score
            </div>
            <div className="mt-2 font-[var(--font-mono)] text-[3rem] leading-none">
              {newScore}
              <span className="text-[var(--text-mono)] text-[var(--color-muted)]"> / 30</span>
            </div>
            <div className="mt-3 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-paper)]">
              {newLabel}
            </div>
          </div>
          <div className="border border-[var(--color-rule)] rounded-[8px] p-5">
            <div className="text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
              {isChained ? "Adjusted weights" : "Default weights"}
            </div>
            <ul className="mt-2 space-y-1 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)]">
              <li>federal_concentration: {weights.federal_concentration}</li>
              <li>cra_loops: {weights.cra_loops}</li>
              <li>t3010_violations: {weights.t3010_violations}</li>
              <li>dataset_cross_coverage: {weights.dataset_cross_coverage}</li>
            </ul>
          </div>
        </section>

        {reasonParam && (
          <section className="mt-12 max-w-[720px]">
            <div className="text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
              Chain reason
            </div>
            <blockquote className="mt-3 border-l border-[var(--color-rule)] pl-5 italic text-[var(--text-body)] leading-[1.55]">
              {reasonParam}
            </blockquote>
          </section>
        )}

        <section className="mt-16">
          <ProofTokenStrip token={found.token} />
        </section>

        <section className="mt-16 flex gap-6 font-[var(--font-mono)] text-[var(--text-small)]">
          <a
            href={`/proof/rerun/${found.token.proofId}`}
            className="border border-[var(--color-rule)] rounded-[6px] px-4 py-2 hover:border-[var(--color-paper)]"
          >
            Adjust weights
          </a>
          <a
            href={`/api/proof/${found.token.proofId}/download`}
            download
            className="text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-paper)]"
          >
            Download token (JSON)
          </a>
          <a
            href={`/verify/${found.token.proofId}`}
            className="text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-paper)]"
          >
            Verify
          </a>
        </section>
      </main>
    </>
  );
}
