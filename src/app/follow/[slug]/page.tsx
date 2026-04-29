import { notFound } from "next/navigation";
import Link from "next/link";
import { getPattern, TRACE_ATTRIBUTION_LINE } from "@/lib/patterns/registry";
import { getDetector } from "@/lib/patterns/detectors";
import type { PatternMatch, SignalStrength } from "@/lib/patterns/types";
import { PatternStatusPill } from "@/components/follow/PatternStatusPill";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPattern(slug);
  return { title: p ? `${p.name} — Glassbox` : "Pattern — Glassbox" };
}

const SEV_COLOR: Record<SignalStrength, string> = {
  observation: "var(--color-fg-muted)",
  attention: "var(--color-accent-warn)",
  flag: "var(--color-accent-fail)",
};

export default async function PatternDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) notFound();

  const detector = getDetector(slug);
  let matches: PatternMatch[] = [];
  let detectorError: string | null = null;
  if (detector) {
    try {
      matches = await detector.detect({ limit: 25 });
    } catch (e) {
      detectorError = (e as Error).message;
    }
  }

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-20 pb-12">
          <div className="flex items-baseline gap-3">
            <Link
              href={"/follow" as never}
              className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            >
              Follow the money
            </Link>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]">/</span>
            <PatternStatusPill status={pattern.status} />
          </div>
          <h1 className="mt-4 text-[var(--text-display-lg)] leading-[0.95] tracking-[var(--tracking-display-lg)]">
            {pattern.name}<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-6 max-w-[760px] text-[var(--text-body-lg)] italic text-[var(--color-fg-muted)] leading-[1.45]">
            {pattern.definition}
          </p>
          <div className="mt-8 max-w-[820px] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] leading-relaxed">
            <span className="text-[var(--color-fg-muted)]">Detection signal · </span>
            {pattern.signal}
          </div>
          {pattern.attribution === "TRACE" && (
            <div className="mt-3 max-w-[820px] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
              {TRACE_ATTRIBUTION_LINE}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12">
        {detector ? (
          detectorError ? (
            <DetectorErrorPanel error={detectorError} />
          ) : matches.length > 0 ? (
            <MatchList matches={matches} />
          ) : (
            <NoMatchesPanel />
          )
        ) : (
          <PendingPanel pattern={pattern} />
        )}
      </section>

      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href={"/follow" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← All patterns
          </Link>
          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Attribution: {pattern.attribution === "TRACE" ? "Alberta TRACE methodology" : "Glassbox-native"}
          </div>
        </div>
      </section>
    </main>
  );
}

function MatchList({ matches }: { matches: PatternMatch[] }) {
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-[20px] tracking-tight">
          {matches.length.toLocaleString("en-CA")} {matches.length === 1 ? "match" : "matches"}
        </h2>
        <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          Detection run · {new Date(matches[0].detectedAt).toUTCString()}
        </div>
      </div>
      <ul className="space-y-3">
        {matches.map((m) => (
          <li
            key={m.matchId}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5 hover:border-[var(--color-border-strong)] transition-colors"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[16px] tracking-tight truncate">
                {m.subject.canonicalName}
              </h3>
              <span
                className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] whitespace-nowrap"
                style={{ color: SEV_COLOR[m.signalStrength] }}
              >
                {m.signalStrength}
              </span>
            </div>
            <div className="mt-1 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              {m.subject.type} · {m.subject.id}
            </div>
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
              {m.calibratedSummary}
            </p>
            <div className="mt-3 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
              {m.evidence.length} source records cited
            </div>
            {m.subject.type === "agreement" && (
              <Link
                href={`/record/fed/${encodeURIComponent(m.subject.id)}` as never}
                className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline"
              >
                View source record →
              </Link>
            )}
            {m.subject.type === "recipient" && (
              <Link
                href={`/recipient/${encodeURIComponent(m.subject.id)}` as never}
                className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline"
              >
                View recipient profile →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoMatchesPanel() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-10 text-center">
      <h3 className="text-[15px] tracking-tight">No matches above threshold</h3>
      <p className="mt-3 max-w-[520px] mx-auto text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
        The detector ran successfully and produced no records meeting the signal threshold for
        this snapshot. The dataset shows what is in the published record and nothing else.
      </p>
    </div>
  );
}

function DetectorErrorPanel({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-accent-fail)]/30 bg-[var(--color-bg-elev-1)] p-8">
      <h3 className="text-[15px] tracking-tight text-[var(--color-accent-fail)]">
        Detector error
      </h3>
      <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">{error}</p>
    </div>
  );
}

function PendingPanel({ pattern }: { pattern: ReturnType<typeof getPattern> }) {
  if (!pattern) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-8">
      {pattern.status === "beta" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector in beta</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            Detection logic is partially implemented. Results may be incomplete. The registry
            entry above describes what the detector is searching for; full match output ships in
            the next deploy.
          </p>
        </div>
      )}
      {pattern.status === "coming" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector pending</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            The pattern is defined and its detection signal is documented. The detector itself is
            not yet running — typically because the underlying source data has not yet been
            ingested or because the detection logic requires schema work.
          </p>
        </div>
      )}
      {pattern.status === "live" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector wiring pending</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            The pattern is defined live; the detector runtime registration ships in the next
            deploy. API endpoint:{" "}
            <code className="font-[var(--font-mono)] text-[12px] mx-1 px-1.5 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
              /api/patterns/{pattern.id}/matches
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
