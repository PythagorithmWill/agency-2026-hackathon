import Link from "next/link";
import { describeConcentration } from "@/lib/analytics/concentration";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";
import { Panel } from "@/components/transparency/Panel";
import { AnimatedNumber } from "@/components/viz/AnimatedNumber";
import { AnimatedBar } from "@/components/viz/AnimatedBar";
import { AnimatedDonut } from "@/components/viz/AnimatedDonut";
import { LorenzCurve } from "@/components/viz/LorenzCurve";

export const metadata = { title: "Transparency dashboard — Glassbox" };

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function TransparencyOverview() {
  const snap = await loadSnapshot();

  if (!snap) {
    return (
      <main className="min-h-screen pt-32 mx-auto max-w-[760px] px-6">
        <h1 className="text-[var(--text-display-md)] tracking-[var(--tracking-display-md)]">
          Snapshot pending
        </h1>
        <p className="mt-4 text-[var(--color-fg-muted)]">
          The analytics snapshot is being regenerated. The fast-path build
          augments the existing snapshot with the latest pattern-detector
          output without rerunning the heavy aggregations:
        </p>
        <p className="mt-3">
          <code className="font-[var(--font-mono)] text-[13px] text-[var(--color-accent)]">
            npx tsx scripts/augment-snapshot.ts
          </code>
        </p>
        <p className="mt-4 text-[var(--color-fg-muted)] text-[14px]">
          Once it finishes (~3–5 min), reload this page.
        </p>
      </main>
    );
  }

  const provinceSlices = snap.provinceTotals.slice(0, 8).map((p) => ({
    label: p.province,
    value: p.total,
  }));
  const otherProvincesTotal = snap.provinceTotals
    .slice(8)
    .reduce((s, p) => s + p.total, 0);
  if (otherProvincesTotal > 0) {
    provinceSlices.push({ label: "Other", value: otherProvincesTotal });
  }

  return (
    <main className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · transparency dashboard
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            Where federal money goes,
            <br />
            <span className="text-[var(--color-fg-muted)]">and to whom.</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {snap.overview.agreementCountFed.toLocaleString("en-CA")} federal grant
            and contribution agreements (current amendment per record), drawn from the Government of
            Canada Open Data corpus. Snapshot built {new Date(snap.generatedAt).toUTCString()}.
          </p>
        </div>
      </section>

      <DashboardTabs />

      {/* KPI strip */}
      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Total federal spend"
            value={snap.overview.totalSpendFed}
            format="currency-compact"
          />
          <KpiTile
            label="Recipients"
            value={snap.overview.recipientCountFed}
            format="number"
          />
          <KpiTile
            label="Departments"
            value={snap.overview.departmentCountFed}
            format="number"
          />
          <KpiTile
            label="Programs"
            value={snap.overview.programCountFed}
            format="number"
          />
        </div>
      </section>

      {/* 6-panel grid */}
      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Top departments */}
          <Panel
            title="Top departments by spend"
            caption="Federal funding source. Click View for the full department list."
            href="/transparency/departments"
          >
            {snap.topDepartments.length > 0 ? (
              <AnimatedBar
                rows={snap.topDepartments.slice(0, 8).map((d) => ({
                  label: d.department,
                  value: d.total,
                  sublabel: `${d.agreementCount.toLocaleString("en-CA")} agreements · ${d.recipientCount.toLocaleString("en-CA")} recipients`,
                }))}
                format="currency-compact"
              />
            ) : (
              <Empty />
            )}
          </Panel>

          {/* 2. Top programs */}
          <Panel
            title="Top programs by spend"
            caption="Funding-program view. Departments shown as caption."
            href="/transparency/programs"
          >
            {snap.topPrograms.length > 0 ? (
              <AnimatedBar
                rows={snap.topPrograms.slice(0, 8).map((p) => ({
                  label: p.program,
                  value: p.total,
                  sublabel: `${p.department} · ${p.agreementCount.toLocaleString("en-CA")} agreements`,
                }))}
                format="currency-compact"
                color="var(--color-accent-warn)"
              />
            ) : (
              <Empty />
            )}
          </Panel>

          {/* 3. Recipient province distribution (donut) */}
          <Panel
            title="Spend by recipient province"
            caption="Geographic distribution of federal funds. Recipient-side, not delivery-side."
          >
            {provinceSlices.length > 0 ? (
              <AnimatedDonut
                slices={provinceSlices}
                centerLabel={compactDollar(provinceSlices.reduce((s, x) => s + x.value, 0))}
                centerSubtext="total mapped"
              />
            ) : (
              <Empty />
            )}
          </Panel>

          {/* 4. Concentration — Lorenz */}
          <Panel
            title="Recipient concentration"
            caption={describeConcentration(snap.concentration)}
            span={2}
            href="/transparency/recipients"
          >
            {snap.concentration.recipientCount > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <LorenzCurve
                  decileBreakdown={snap.concentration.decileBreakdown}
                  gini={snap.concentration.gini}
                />
                <div>
                  <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-2">
                    Top 10 recipients (top-25k slice)
                  </div>
                  <AnimatedBar
                    rows={snap.concentration.top10.slice(0, 10).map((r) => ({
                      label: r.recipient,
                      value: r.total,
                      sublabel: `${(r.share * 100).toFixed(1)}% · ${r.agreementCount.toLocaleString("en-CA")} agreements`,
                    }))}
                    format="currency-compact"
                  />
                </div>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>

          {/* 5. Amendment-growth flags */}
          <Panel
            title="Amendment growth · current flags"
            caption={
              snap.amendmentGrowth.length > 0
                ? `${snap.amendmentGrowth.length} agreements where current value is ≥200% of initial.`
                : "No agreements above the 200% growth threshold in this snapshot."
            }
            href="/transparency/risk"
          >
            {snap.amendmentGrowth.length > 0 ? (
              <ul className="space-y-3">
                {snap.amendmentGrowth.slice(0, 6).map((g, idx) => (
                  <li
                    key={`${g.refNumber}#${idx}`}
                    className="border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
                  >
                    <Link
                      href={`/record/fed/${encodeURIComponent(g.refNumber)}` as never}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] text-[var(--color-fg)]">
                            {g.recipient}
                          </div>
                          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
                            {g.department} · {g.amendmentCount} amendments
                          </div>
                        </div>
                        <div className="font-[var(--font-mono)] text-[12px] tabular-nums text-[var(--color-accent-warn)] whitespace-nowrap">
                          +{(g.growthPercent * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="mt-1.5 font-[var(--font-mono)] text-[11px] text-[var(--color-fg-muted)]">
                        {compactDollar(g.initialValue)} → {compactDollar(g.currentValue)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Panel>

          {/* 6. Recent large agreements */}
          <Panel
            title="Recent agreements · ≥ $5M"
            caption="Most recently dated current-amendment records."
            span={3}
          >
            {snap.recentLarge.length > 0 ? (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-[13px]">
                  <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="text-left py-2">Recipient</th>
                      <th className="text-left py-2">Department</th>
                      <th className="text-left py-2">Program</th>
                      <th className="text-left py-2">Province</th>
                      <th className="text-right py-2">Value</th>
                      <th className="text-left py-2 pl-4">Start</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.recentLarge.slice(0, 12).map((r, idx) => (
                      <tr
                        key={`${r.recordId}#${idx}`}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elev-2)]/40"
                      >
                        <td className="py-2 pr-4 max-w-[260px] truncate">
                          <Link
                            href={`/record/fed/${encodeURIComponent(r.recordId)}` as never}
                            className="hover:text-[var(--color-accent)]"
                          >
                            {r.recipient}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate text-[var(--color-fg-muted)]">
                          {r.department}
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate text-[var(--color-fg-muted)]">
                          {r.program ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-fg-muted)]">
                          {r.province ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-right font-[var(--font-mono)] tabular-nums">
                          {dollar.format(r.value)}
                        </td>
                        <td className="py-2 pl-4 font-[var(--font-mono)] text-[var(--color-fg-muted)]">
                          {r.startDate?.slice(0, 10) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </div>
      </section>

      {/* Footer methodology link */}
      <section className="border-t border-[var(--color-border)] py-12 mt-12">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-baseline justify-between gap-4">
          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] max-w-[640px]">
            Glassbox derives every figure from the source corpus. The dataset shows what is in the
            published record and nothing else. Aggregations are precomputed nightly; record-level
            queries hit the live replica.
          </div>
          <Link
            href={"/methodology" as never}
            className="text-[13px] underline-offset-4 hover:underline text-[var(--color-fg-muted)]"
          >
            Read the methodology →
          </Link>
        </div>
      </section>
    </main>
  );
}

function KpiTile({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: "currency-compact" | "number";
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-2 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] tabular-nums">
        <AnimatedNumber value={value} format={format} />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-8">
      Source query returned no rows.
    </div>
  );
}
