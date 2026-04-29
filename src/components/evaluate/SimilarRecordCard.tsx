"use client";

import { useState } from "react";
import type { ComparableRecord } from "@/lib/types";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function SimilarRecordCard({
  record,
  index,
}: {
  record: ComparableRecord;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const sim = Math.round(record.similarity * 100);

  return (
    <article
      style={{
        opacity: 0,
        transform: "translateY(4px)",
        animation: `record-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 40}ms forwards`,
      }}
      className="rounded-[16px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-6 transition-colors hover:bg-[var(--color-bg-elev-2)]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
        <div>
          <h3 className="text-[var(--text-heading)] tracking-[var(--tracking-heading)] font-medium">
            {record.recipientLegalName}
          </h3>
          <div className="mt-2 font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-muted)]">
            {record.programCode ?? "—"} · FY{record.fiscalYear} · {cad.format(record.agreementValue)}
            {record.recipientProvince && <> · {record.recipientProvince}</>}
          </div>
          <p className="mt-3 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg-muted)] line-clamp-2">
            {record.description}
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-4 inline-flex items-center gap-2 text-[var(--text-body-sm)] text-[var(--color-accent)] hover:underline-offset-2 hover:underline"
          >
            {open ? "Hide source row ↑" : "View source row →"}
          </button>
        </div>
        <div className="min-w-[200px]">
          <SimilarityBar score={sim} />
        </div>
      </div>

      {open && (
        <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
          <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Source row · {record.sourceDataset}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 font-[var(--font-mono)] text-[var(--text-mono)]">
            <Cell label="Record id" value={record.recordId} />
            <Cell label="Recipient BN" value={record.recipientBn ?? "—"} />
            <Cell label="Awarding dept" value={record.awardingDept} />
            <Cell label="Province" value={record.recipientProvince ?? "—"} />
            <Cell label="Fiscal year" value={`FY${record.fiscalYear}`} />
            <Cell label="Amount (current)" value={cad.format(record.agreementValue)} />
            <Cell label="Retrieval" value={record.retrievalReason} />
            <Cell label="Similarity" value={record.similarity.toFixed(3)} />
          </dl>
          <p className="mt-4 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg)]">
            {record.description}
          </p>
        </div>
      )}

      <style>{`
        @keyframes record-enter {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </article>
  );
}

function SimilarityBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "var(--color-accent-fail)"
      : score >= 50
        ? "var(--color-accent-warn)"
        : "var(--color-accent)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] font-semibold" style={{ color }}>
          {score}
        </span>
        <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-fg-subtle)]">
          / 100
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: 0,
            backgroundColor: color,
            animation: `sim-fill 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            ["--target-width" as string]: `${score}%`,
          }}
        />
      </div>
      <style>{`
        @keyframes sim-fill {
          to { width: var(--target-width); }
        }
      `}</style>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--color-fg-subtle)] uppercase tracking-[0.08em] text-[10px]">
        {label}
      </dt>
      <dd className="text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
