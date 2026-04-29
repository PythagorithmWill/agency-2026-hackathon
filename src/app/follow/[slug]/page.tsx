import { notFound } from "next/navigation";
import Link from "next/link";
import { getPattern, TRACE_ATTRIBUTION_LINE } from "@/lib/patterns/registry";
import { PatternStatusPill } from "@/components/follow/PatternStatusPill";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPattern(slug);
  return { title: p ? `${p.name} — Glassbox` : "Pattern — Glassbox" };
}

export default async function PatternDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) notFound();

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

      {/* Status */}
      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-8">
          {pattern.status === "live" && (
            <div>
              <h3 className="text-[15px] tracking-tight">Detector live</h3>
              <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
                The detector is implemented and producing matches. Result rendering is being
                connected to this page in the next deploy. Until then, the registry entry above is
                authoritative for the pattern definition; matches are accessible via the API at
                <code className="font-[var(--font-mono)] text-[12px] mx-1 px-1.5 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
                  /api/patterns/{pattern.id}/matches
                </code>
                (coming soon).
              </p>
            </div>
          )}
          {pattern.status === "beta" && (
            <div>
              <h3 className="text-[15px] tracking-tight">Detector in beta</h3>
              <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
                Detection logic is partially implemented. Results may be incomplete. The registry
                entry above describes what the detector is searching for; full match output ships
                in the next deploy.
              </p>
            </div>
          )}
          {pattern.status === "coming" && (
            <div>
              <h3 className="text-[15px] tracking-tight">Detector pending</h3>
              <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
                The pattern is defined and its detection signal is documented. The detector itself
                is not yet running — typically because the underlying source data has not yet been
                ingested or because the detection logic requires schema work. Status updates will
                appear here.
              </p>
            </div>
          )}
        </div>
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
            Pattern attribution: {pattern.attribution === "TRACE" ? "Alberta TRACE methodology" : "Glassbox-native"}
          </div>
        </div>
      </section>
    </main>
  );
}
