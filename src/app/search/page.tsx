import Link from "next/link";
import { searchCorpus } from "@/lib/evaluate/retrieval";
import { SimilarRecordCard } from "@/components/evaluate/SimilarRecordCard";
import { SearchEditBar } from "@/components/SearchEditBar";
import { SourceBreakdown } from "@/components/SourceBreakdown";

export const metadata = { title: "Search — Glassbox" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawQ = typeof sp.q === "string" ? sp.q : "";
  const rawDept = typeof sp.dept === "string" ? sp.dept : undefined;
  const q = rawQ.trim();

  const result = q
    ? await searchCorpus(q, rawDept)
    : {
        records: [],
        bySource: { fed: 0, ab_grants: 0, ab_contracts: 0, general: 0 },
        latencyMs: 0,
        retrievalMode: "keyword" as const,
      };

  const { records, bySource, latencyMs, retrievalMode } = result;

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1080px] px-6 pt-24 pb-16">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Search the corpus
          </div>
          <div className="mt-6">
            {q ? (
              <SearchEditBar initialQuery={q} />
            ) : (
              <Link
                href={"/" as never}
                className="text-[20px] text-[var(--color-fg-muted)] underline-offset-4 hover:underline"
              >
                No query — return to the homepage to start a search.
              </Link>
            )}
          </div>
          {q && (
            <>
              <div className="mt-4 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                {records.length} {records.length === 1 ? "record" : "records"}
                {" · "}
                {retrievalMode} retrieval
                {" · "}
                {latencyMs}ms
              </div>
              {records.length > 0 && (
                <div className="mt-3">
                  <SourceBreakdown bySource={bySource} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {q && records.length > 0 && (
        <section className="mx-auto max-w-[1080px] px-6 py-16">
          <div className="max-w-[760px] space-y-4">
            {records.map((r, i) => (
              <SimilarRecordCard key={`${r.sourceDataset}-${r.recordId}`} record={r} index={i} />
            ))}
          </div>
        </section>
      )}

      {q && records.length === 0 && (
        <section className="mx-auto max-w-[1080px] px-6 py-16">
          <div className="max-w-[640px] rounded-[16px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-8">
            <div className="text-[clamp(28px,3.5vw,36px)] tracking-[-0.02em] font-semibold leading-[1.1]">
              No matches found.
            </div>
            <p className="mt-4 text-[14px] text-[var(--color-fg-muted)] leading-[20px]">
              Try fewer terms or a different department. Retrieval runs
              against federal{" "}
              <code className="font-[var(--font-mono)] mx-0.5 text-[var(--color-fg)]">
                grants_contributions
              </code>
              {" "}and Alberta provincial{" "}
              <code className="font-[var(--font-mono)] mx-0.5 text-[var(--color-fg)]">
                ab_grants
              </code>
              {" "}+{" "}
              <code className="font-[var(--font-mono)] mx-0.5 text-[var(--color-fg)]">
                ab_contracts
              </code>
              {" "}with the F-3, A-13, A-10 landmine guards applied.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
