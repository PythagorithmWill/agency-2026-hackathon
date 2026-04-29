import Link from "next/link";
import { searchCorpus } from "@/lib/evaluate/retrieval";
import { SimilarRecordCard } from "@/components/evaluate/SimilarRecordCard";
import { SearchEditBar } from "@/components/SearchEditBar";
import { SourceBreakdown } from "@/components/SourceBreakdown";

const EXAMPLES = [
  "indigenous broadband",
  "homelessness",
  "artificial intelligence",
  "clean technology",
  "mental health",
  "research chairs",
] as const;

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
            <SearchEditBar initialQuery={q} />
          </div>
          {!q && (
            <div className="mt-6 max-w-[720px]">
              <p className="text-[16px] leading-[24px] text-[var(--color-fg-muted)]">
                Search the federal grants corpus (1.27M records) and the
                Alberta provincial corpus (2.05M records) by topic, recipient,
                or program. Hybrid keyword retrieval, ranked across sources,
                with every result citing its source row.
              </p>
              <div className="mt-5 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                Try one of these:
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <Link
                      href={`/search?q=${encodeURIComponent(ex)}` as never}
                      className="inline-block px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      {ex}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          <div className="max-w-[760px] rounded-[16px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-8">
            <div className="text-[clamp(28px,3.5vw,36px)] tracking-[-0.02em] font-semibold leading-[1.1]">
              No matches found for &ldquo;{q}&rdquo;.
            </div>
            <p className="mt-4 text-[15px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[640px]">
              Glassbox searched the federal grants &amp; contributions corpus
              (1.27M records) and Alberta provincial sources (2.05M records)
              for descriptions matching your query, with ts_rank ordering and
              landmine guards applied. No agreement description matched.
            </p>

            <div className="mt-6">
              <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                Things to try
              </div>
              <ul className="mt-3 space-y-2.5 text-[14px] text-[var(--color-fg)] leading-[1.55]">
                <li>
                  <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
                  <strong>Use the words the corpus uses.</strong> Government
                  descriptions are formal — try{" "}
                  <SuggestLink q="artificial intelligence" />,{" "}
                  <SuggestLink q="machine learning" />, or{" "}
                  <SuggestLink q="data analytics" />{" "}rather than &ldquo;AI&rdquo; or
                  &ldquo;data&rdquo;.
                </li>
                <li>
                  <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
                  <strong>Use plain-language topics.</strong> Try{" "}
                  <SuggestLink q="indigenous broadband" />,{" "}
                  <SuggestLink q="homelessness" />,{" "}
                  <SuggestLink q="mental health" />, or{" "}
                  <SuggestLink q="research chair" />.
                </li>
                <li>
                  <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
                  <strong>Search a recipient instead.</strong> Try{" "}
                  <SuggestLink q="ryerson" />,{" "}
                  <SuggestLink q="university of alberta" />, or any organization
                  you&apos;re curious about.
                </li>
                <li>
                  <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
                  <strong>Look at the named patterns instead.</strong>{" "}
                  <Link
                    href={"/follow" as never}
                    className="text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    /follow
                  </Link>{" "}
                  surfaces twelve detection patterns over the same data —
                  funding loops, sole-source amendment creep, zombie
                  recipients, and others — without you needing to guess the
                  right keyword.
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--color-border)] font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
              Why this happens · the corpus is government-issued text. Acronyms
              are usually spelled out. Glassbox auto-expands a small list of
              common ones (AI, ML, EV, NLP, IoT, &amp; others) but the
              underlying records still need to contain the matching phrase to
              return. {latencyMs > 0 && `Search took ${latencyMs}ms.`}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function SuggestLink({ q }: { q: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(q)}` as never}
      className="text-[var(--color-accent)] underline-offset-4 hover:underline"
    >
      &ldquo;{q}&rdquo;
    </Link>
  );
}
