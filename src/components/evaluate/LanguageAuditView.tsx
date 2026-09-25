"use client";

import { useMemo, useState } from "react";
import type { CalibrationFlag } from "@/lib/types";
import { buildCalibratedDraft, describeAction, type CalibratedChange } from "@/lib/evaluate/calibrated";

/**
 * Calibrated language review.
 *
 * Left: the calibrated draft — every documented substitution applied, each
 * change footnoted with its number. Toggle to the original with flagged
 * phrases underlined (hover for the validator's guidance).
 * Right: the ordered change list (original → replacement, flag type, why)
 * and the .docx download. Stacks on narrow screens.
 *
 * The calibrated text and the list come from one pure function
 * (`buildCalibratedDraft`) shared with the .docx route, so the screen and
 * the download never disagree.
 */
export function LanguageAuditView({
  draftText,
  flags,
  evaluationId,
}: {
  draftText: string;
  flags: CalibrationFlag[];
  evaluationId?: string;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"calibrated" | "original">("calibrated");

  const originalSegments = useMemo(() => splitByFlags(draftText, flags), [draftText, flags]);
  const calibrated = useMemo(() => buildCalibratedDraft(draftText, flags), [draftText, flags]);

  const downloadHref = evaluationId
    ? `/api/draft/${encodeURIComponent(evaluationId)}/calibrated.docx`
    : null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(calibrated.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  if (flags.length === 0) {
    return (
      <div className="rounded-[16px] border border-[var(--color-accent)]/30 bg-[var(--color-bg-elev-1)] p-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
          <span className="text-[var(--color-accent)]">PYTH-GOV: passed · 0 calibration flags</span>
          {downloadHref && <DownloadButton href={downloadHref} />}
        </div>
        <p className="mt-3 text-[var(--text-body)] leading-[24px] text-[var(--color-fg)]">
          The draft text contains no phrases that the calibrated-language
          regex set flags as absolute, causal, or editorial. The text would
          pass the same gate the system applies to its own published output.
        </p>
        <pre className="mt-4 font-[var(--font-sans)] text-[var(--text-body)] leading-[24px] text-[var(--color-fg-muted)] whitespace-pre-wrap">
          {draftText}
        </pre>
      </div>
    );
  }

  const auto = calibrated.counts.replace + calibrated.counts.remove;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
        {/* Left — the draft */}
        <div className="rounded-[16px] border border-[var(--color-accent-warn)]/30 bg-[var(--color-bg-elev-1)] p-6 min-w-0">
          <div className="flex items-baseline justify-between gap-4 flex-wrap font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
            <span className="text-[var(--color-accent-warn)]">
              PYTH-GOV: {flags.length} flag{flags.length === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-4 flex-wrap">
              <span className="inline-flex shrink-0 rounded-[6px] border border-[var(--color-border-strong)] overflow-hidden">
                <ViewTab active={view === "calibrated"} onClick={() => setView("calibrated")}>
                  Calibrated
                </ViewTab>
                <ViewTab active={view === "original"} onClick={() => setView("original")}>
                  Original
                </ViewTab>
              </span>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                {copied ? "Copied →" : "Copy calibrated ↗"}
              </button>
            </span>
          </div>

          {view === "calibrated" ? (
            <p
              data-testid="calibrated-draft"
              className="mt-4 text-[var(--text-body)] leading-[28px] font-[var(--font-sans)] text-[var(--color-fg)] whitespace-pre-wrap"
            >
              {calibrated.segments.map((seg, i) => {
                if (!seg.change) return <span key={i}>{seg.text}</span>;
                const c = seg.change;
                const tone =
                  c.action === "manual"
                    ? "calibration-flag"
                    : "underline decoration-[var(--color-accent)] decoration-1 underline-offset-4";
                return (
                  <span key={i} className={tone}>
                    {seg.text}
                    <sup
                      aria-label={`change ${c.n}`}
                      className="ml-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-accent)] select-none"
                    >
                      {c.n}
                    </sup>
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="mt-4 text-[var(--text-body)] leading-[28px] font-[var(--font-sans)] text-[var(--color-fg)] whitespace-pre-wrap">
              {originalSegments.map((seg, i) =>
                seg.flag ? (
                  <span
                    key={i}
                    className="calibration-flag relative"
                    onMouseEnter={() => setHoveredId(i)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {seg.text}
                    {hoveredId === i && (
                      <span className="absolute z-20 top-full left-0 mt-2 w-[320px] max-w-[80vw] rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.5)] text-[var(--text-body-sm)] leading-[20px] not-italic font-[var(--font-sans)] no-underline">
                        <span className="block font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-accent-warn)]">
                          {seg.flag.type}
                        </span>
                        <span className="block mt-2 text-[var(--color-fg)]">
                          Match: <span className="text-[var(--color-accent-warn)]">&ldquo;{seg.flag.match}&rdquo;</span>
                        </span>
                        {seg.flag.rewrite && (
                          <span className="block mt-2 text-[var(--color-fg-muted)]">
                            Suggest: {seg.flag.rewrite}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
          )}

          <p className="mt-4 text-[var(--text-body-sm)] text-[var(--color-fg-subtle)] leading-[20px]">
            {view === "calibrated"
              ? `${auto} change${auto === 1 ? "" : "s"} applied from the calibrated lexicon` +
                (calibrated.counts.manual > 0
                  ? `; ${calibrated.counts.manual} phrase${calibrated.counts.manual === 1 ? "" : "s"} kept for manual edit (amber).`
                  : ".")
              : "Hover any underlined phrase for the validator's guidance. The Auditor General's published audits use calibrated alternatives for each."}
          </p>
        </div>

        {/* Right — the change list */}
        <aside className="min-w-0" data-testid="calibration-changes">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              Calibration changes · {calibrated.changes.length}
            </div>
            {downloadHref && <DownloadButton href={downloadHref} />}
          </div>
          <ol className="mt-4 space-y-3">
            {calibrated.changes.map((c) => (
              <ChangeRow key={c.n} change={c} />
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function ChangeRow({ change: c }: { change: CalibratedChange }) {
  const manual = c.action === "manual";
  const accent = manual ? "var(--color-accent-warn)" : "var(--color-accent)";
  return (
    <li className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4">
      <div className="flex items-baseline justify-between gap-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em]">
        <span style={{ color: accent }}>
          {c.n}. {c.type.replace(/_/g, " ")}
        </span>
        <span className="text-[var(--color-fg-subtle)]">{describeAction(c)}</span>
      </div>
      <div className="mt-2 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg)] break-words">
        <span className="line-through decoration-[var(--color-fg-subtle)] text-[var(--color-fg-muted)]">
          &ldquo;{c.original}&rdquo;
        </span>
        <span aria-hidden className="mx-2 text-[var(--color-fg-subtle)]">
          →
        </span>
        {c.action === "replace" && <span style={{ color: accent }}>&ldquo;{c.replacement}&rdquo;</span>}
        {c.action === "remove" && (
          <span className="italic" style={{ color: accent }}>
            (removed)
          </span>
        )}
        {manual && (
          <span className="italic" style={{ color: accent }}>
            kept — rewrite by hand
          </span>
        )}
      </div>
      <div className="mt-2 text-[var(--text-body-sm)] leading-[20px] text-[var(--color-fg-muted)]">{c.reason}</div>
      {manual && c.guidance && (
        <div className="mt-1 text-[var(--text-caption)] leading-[16px] text-[var(--color-fg-subtle)]">
          Validator: {c.guidance}
        </div>
      )}
    </li>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "px-2.5 py-1 transition-colors " +
        (active
          ? "bg-[var(--color-bg-elev-2)] text-[var(--color-fg)]"
          : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]")
      }
    >
      {children}
    </button>
  );
}

function DownloadButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--color-border-strong)] px-3 py-1.5 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg)] hover:border-[var(--color-fg)] transition-colors whitespace-nowrap"
    >
      Download calibrated draft (.docx)
      <span aria-hidden>↓</span>
    </a>
  );
}

function splitByFlags(
  text: string,
  flags: CalibrationFlag[],
): { text: string; flag?: CalibrationFlag }[] {
  if (flags.length === 0) return [{ text }];
  const segments: { text: string; flag?: CalibrationFlag }[] = [];
  let cursor = 0;
  for (const f of flags) {
    if (f.start < cursor || f.end > text.length) continue;
    if (f.start > cursor) segments.push({ text: text.slice(cursor, f.start) });
    segments.push({ text: text.slice(f.start, f.end), flag: f });
    cursor = f.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
