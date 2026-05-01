import { notFound } from "next/navigation";
import { loadRecord, loadAmendmentChain, searchCorpus } from "@/lib/evaluate/retrieval";
import { SourceBadge, getSourceLabel } from "@/components/SourceBadge";
import { SimilarRecordCard } from "@/components/evaluate/SimilarRecordCard";
import { AmendmentTimeline } from "@/components/record/AmendmentTimeline";
import type { DatasetSource } from "@/lib/types";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const SEGMENT_TO_SOURCE: Record<string, DatasetSource> = {
  fed: "fed",
  "ab-grants": "ab_grants",
  "ab-contracts": "ab_contracts",
};

export const metadata = { title: "Record — Glassbox" };

export default async function RecordPage({
  params,
}: {
  params: Promise<{ source: string; recordId: string }>;
}) {
  const { source: rawSource, recordId: rawId } = await params;
  const source = SEGMENT_TO_SOURCE[rawSource];
  if (!source) notFound();
  const recordId = decodeURIComponent(rawId);

  const [record, amendments] = await Promise.all([
    loadRecord(source, recordId),
    loadAmendmentChain(source, recordId),
  ]);
  if (!record) notFound();

  // Related records: same retrieval engine, query keyed on the recipient name
  const relatedQuery = record.recipientLegalName.split(/[|·]/)[0].trim();
  const related = relatedQuery
    ? (await searchCorpus(relatedQuery)).records
        .filter((r) => !(r.sourceDataset === source && r.recordId === recordId))
        .slice(0, 5)
    : [];

  const isFed = source === "fed";

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1080px] px-4 sm:px-6 pt-24 pb-16">
          <div className="flex items-baseline gap-3 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            <span>Source record</span>
            <SourceBadge source={source} />
          </div>
          <h1 className="mt-6 text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-[-0.03em] font-semibold">
            {record.recipientLegalName}
          </h1>
          <div className="mt-4 font-[var(--font-mono)] text-[13px] text-[var(--color-fg-muted)] flex flex-wrap gap-x-4 gap-y-1">
            <span>{getSourceLabel(source)}</span>
            {record.programCode && <span>· {record.programCode}</span>}
            <span>· {record.awardingDept.split(" | ")[0]}</span>
            <span>· FY{record.fiscalYear}</span>
            <span>· {cad.format(record.agreementValue)}</span>
            {record.recipientBn && <span>· BN {record.recipientBn}</span>}
            {record.recipientProvince && <span>· {record.recipientProvince}</span>}
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-[1080px] px-4 sm:px-6 py-16">
        {/* Description */}
        <section className="max-w-[720px]">
          <h2 className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Description
          </h2>
          <p className="mt-4 text-[18px] leading-[1.55] text-[var(--color-fg)] whitespace-pre-wrap">
            {record.description || "No description in the public record."}
          </p>
        </section>

        {/* Amendment chain (federal only) */}
        {isFed && amendments.length > 0 && (
          <section className="mt-24 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Amendment chain · {amendments.length} {amendments.length === 1 ? "entry" : "entries"}
            </h2>
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[20px] max-w-[640px]">
              The agreement_value column on
              <code className="font-[var(--font-mono)] mx-1.5">fed.grants_contributions</code>
              is cumulative — naive
              <code className="font-[var(--font-mono)] mx-1.5">SUM</code>
              triple-counts amendments. The header above shows the
              F-3-corrected current commitment. The timeline below shows
              every amendment in the chain.
            </p>
            <div className="mt-8">
              <AmendmentTimeline events={amendments} />
            </div>
          </section>
        )}

        {/* Related records */}
        {related.length > 0 && (
          <section className="mt-24 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Related records · {related.length}
            </h2>
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[20px] max-w-[640px]">
              Closest matches by recipient name across federal and Alberta
              provincial corpora.
            </p>
            <div className="mt-8 max-w-[760px] space-y-4">
              {related.map((r, i) => (
                <SimilarRecordCard
                  key={`${r.sourceDataset}-${r.recordId}`}
                  record={r}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}

        {/* Cite-as */}
        <section className="mt-24 border-t border-[var(--color-border)] pt-12">
          <p className="font-[var(--font-mono)] italic text-[13px] text-[var(--color-fg-subtle)]">
            Cite as: Glassbox record view · {getSourceLabel(source)} · {recordId} ·
            retrieved {new Date().toISOString().slice(0, 10)}.
          </p>
        </section>
      </article>
    </main>
  );
}
