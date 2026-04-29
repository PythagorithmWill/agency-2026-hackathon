import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";
import { AnimatedBar } from "@/components/viz/AnimatedBar";

export const metadata = { title: "Programs — Glassbox" };

export default async function ProgramsTab() {
  const snap = await loadSnapshot();
  const programs = snap?.topPrograms ?? [];
  const totalSpend = programs.reduce((s, p) => s + p.total, 0);

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · programs
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            Federal funding programs
          </h1>
          <p className="mt-4 max-w-[640px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {snap?.overview.programCountFed.toLocaleString("en-CA") ?? "—"} federal
            programs in the corpus. Top {programs.length} ranked by total agreement value across
            recipients.
          </p>
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
          {programs.length > 0 ? (
            <AnimatedBar
              rows={programs.map((p) => ({
                label: p.program,
                value: p.total,
                sublabel: `${p.department} · ${p.agreementCount.toLocaleString("en-CA")} agreements · ${p.recipientCount.toLocaleString("en-CA")} recipients · ${((p.total / totalSpend) * 100).toFixed(1)}% of top-${programs.length}`,
              }))}
              format="currency-compact"
              color="var(--color-accent-warn)"
            />
          ) : (
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-12 text-center">
              Snapshot pending.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
