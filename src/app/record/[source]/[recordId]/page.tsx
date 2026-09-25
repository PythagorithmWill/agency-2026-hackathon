import { notFound } from "next/navigation";
import Link from "next/link";
import { loadRecord, loadAmendmentChain, loadRelatedRecords } from "@/lib/evaluate/retrieval";
import { corpusCached } from "@/lib/cache";

const loadRecordCached = corpusCached(loadRecord, "record");
const loadAmendmentChainCached = corpusCached(loadAmendmentChain, "amendment-chain");
const loadRelatedCached = corpusCached(loadRelatedRecords, "related-records");
import { SourceBadge, getSourceLabel } from "@/components/SourceBadge";
import { AmendmentTimeline } from "@/components/record/AmendmentTimeline";
import { ExpandableText } from "@/components/ExpandableText";
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
    loadRecordCached(source, recordId),
    loadAmendmentChainCached(source, recordId),
  ]);
  if (!record) notFound();

  // Related records by explicit relationship (same recipient / same program).
  const related = await loadRelatedCached(source, {
    recordId,
    recipientLegalName: record.recipientLegalName,
    recipientBn: record.recipientBn,
    awardingDept: record.awardingDept,
    programCode: record.programCode,
  });
  const current = amendments.length > 0 ? amendments[amendments.length - 1] : null;
  const original = amendments.length > 0 ? amendments[0] : null;

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
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[20px] max-w-[680px]">
              Each notch is one published row for this agreement: #0 is the original
              (placed at its start date) and each later notch is an amendment (placed at
              its amendment date). The height is the agreement&apos;s <b>total value as of
              that row</b> — the source column is cumulative, not a change amount — so the
              line reads as the commitment over time and the right-most notch is the current
              commitment shown in the header.
              {original && current && amendments.length > 1 && (
                <>
                  {" "}For this agreement: {cad.format(original.agreementValue)} at start,{" "}
                  {cad.format(current.agreementValue)} after amendment #{current.amendmentNumber}
                  {" "}({current.agreementValue >= original.agreementValue ? "+" : "−"}
                  {cad.format(Math.abs(current.agreementValue - original.agreementValue))}).
                </>
              )}
            </p>
            <div className="mt-8">
              <AmendmentTimeline events={amendments} />
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="text-left py-2">Row</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">Total value as of row</th>
                    <th className="text-right py-2">Change vs previous</th>
                    <th className="text-left py-2 pl-4">Description on this row</th>
                  </tr>
                </thead>
                <tbody>
                  {amendments.map((a, i) => {
                    const prev = i > 0 ? amendments[i - 1] : null;
                    const delta = prev ? a.agreementValue - prev.agreementValue : null;
                    return (
                      <tr key={`${a.amendmentNumber}-${i}`} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 font-[var(--font-mono)]">{i === 0 ? "#0 original" : `#${a.amendmentNumber} amendment`}</td>
                        <td className="py-2 font-[var(--font-mono)] text-[var(--color-fg-muted)]">
                          {a.date ? a.date.slice(0, 10) : "—"}
                          {a.dateKind === "start" && <span className="ml-1 text-[var(--color-fg-subtle)]">(start date)</span>}
                        </td>
                        <td className="py-2 text-right font-[var(--font-mono)] tabular-nums">{cad.format(a.agreementValue)}</td>
                        <td className="py-2 text-right font-[var(--font-mono)] tabular-nums text-[var(--color-fg-muted)]">
                          {delta === null ? "—" : `${delta >= 0 ? "+" : "−"}${cad.format(Math.abs(delta))}`}
                        </td>
                        <td className="py-2 pl-4 text-[var(--color-fg-muted)] max-w-[420px] align-top">
                          <ExpandableText text={a.description} clamp={110} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Related records */}
        {related.length > 0 && (
          <section className="mt-24 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Related records · {related.reduce((n, g) => n + g.records.length, 0)}
            </h2>
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[20px] max-w-[680px]">
              Records are related by an explicit link in the data, stated for each group
              below — never by text similarity. Values are each agreement&apos;s current
              commitment (latest amendment).
            </p>
            {related.map((g) => (
              <div key={g.basis} className="mt-8">
                <h3 className="text-[14px] text-[var(--color-fg)]">{g.reason}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-[13px]">
                    <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                      <tr>
                        <th className="text-left py-2">Ref</th>
                        {g.basis === "same-program" && <th className="text-left py-2">Recipient</th>}
                        <th className="text-left py-2">{g.basis === "same-recipient" ? "Department · program" : "Fiscal year"}</th>
                        <th className="text-right py-2">Current value</th>
                        <th className="text-left py-2 pl-4">FY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.records.map((r) => (
                        <tr key={`${r.sourceDataset}-${r.recordId}`} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elev-2)]/40">
                          <td className="py-2 font-[var(--font-mono)] text-[11px]">
                            <Link href={`/record/${rawSource}/${encodeURIComponent(r.recordId)}` as never} className="text-[var(--color-accent)] hover:underline">
                              {r.recordId}
                            </Link>
                          </td>
                          {g.basis === "same-program" && <td className="py-2 pr-4 max-w-[260px] truncate">{r.recipientLegalName}</td>}
                          <td className="py-2 pr-4 max-w-[320px] truncate text-[var(--color-fg-muted)]">
                            {g.basis === "same-recipient" ? `${r.awardingDept}${r.programCode ? ` · ${r.programCode}` : ""}` : (r.fiscalYear ? `FY${r.fiscalYear}` : "—")}
                          </td>
                          <td className="py-2 text-right font-[var(--font-mono)] tabular-nums">{cad.format(r.agreementValue)}</td>
                          <td className="py-2 pl-4 font-[var(--font-mono)] text-[var(--color-fg-muted)]">{r.fiscalYear ? `FY${r.fiscalYear}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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
