import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";
import { AnimatedBar } from "@/components/viz/AnimatedBar";

export const metadata = { title: "Departments — Glassbox" };

export default async function DepartmentsTab() {
  const snap = await loadSnapshot();
  const departments = snap?.topDepartments ?? [];
  const totalSpend = departments.reduce((s, d) => s + d.total, 0);

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · departments
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            Federal funding departments
          </h1>
          <p className="mt-4 max-w-[640px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {snap?.overview.departmentCountFed.toLocaleString("en-CA") ?? "—"} federal
            departments and agencies funding grants and contributions. Top {departments.length} ranked
            by total agreement value (current amendment per record).
          </p>
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
          {departments.length > 0 ? (
            <AnimatedBar
              rows={departments.map((d) => ({
                label: d.department,
                value: d.total,
                sublabel: `${d.agreementCount.toLocaleString("en-CA")} agreements · ${d.recipientCount.toLocaleString("en-CA")} recipients · ${((d.total / totalSpend) * 100).toFixed(1)}% of top-${departments.length}`,
              }))}
              format="currency-compact"
            />
          ) : (
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-12 text-center">
              Snapshot pending — run scripts/build-snapshot.ts.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
