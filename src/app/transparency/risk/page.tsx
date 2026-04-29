import Link from "next/link";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";

export const metadata = { title: "Risk map — Glassbox" };

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function RiskTab() {
  const snap = await loadSnapshot();
  const growth = snap?.amendmentGrowth ?? [];

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · risk map
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            Detected patterns of interest
          </h1>
          <p className="mt-4 max-w-[760px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {growth.length} agreements where the current amendment value is at
            least 200% of the original commitment, with two or more amendments on file. Patterns
            below are observations, not causal claims — every record links to its source row.
          </p>
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-baseline justify-between">
            <h3 className="text-[15px] tracking-tight">Amendment-growth observations</h3>
            <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              flagType: amendment_growth · threshold: ≥200%
            </div>
          </div>
          {growth.length > 0 ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {growth.map((g, idx) => {
                const sev =
                  g.growthPercent >= 5
                    ? "flag"
                    : g.growthPercent >= 3
                      ? "attention"
                      : "observation";
                const sevColor =
                  sev === "flag"
                    ? "var(--color-accent-fail)"
                    : sev === "attention"
                      ? "var(--color-accent-warn)"
                      : "var(--color-fg-muted)";
                return (
                  <li key={`${g.refNumber}#${idx}`}>
                    <Link
                      href={`/record/fed/${encodeURIComponent(g.refNumber)}` as never}
                      className="block px-6 py-4 hover:bg-[var(--color-bg-elev-2)]/40 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[15px] tracking-tight truncate">{g.recipient}</div>
                          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
                            {g.department} · ref {g.refNumber} · {g.amendmentCount} amendments
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em]"
                            style={{ color: sevColor }}
                          >
                            {sev}
                          </div>
                          <div className="font-[var(--font-mono)] text-[15px] tabular-nums">
                            +{(g.growthPercent * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 font-[var(--font-mono)] text-[12px] text-[var(--color-fg-muted)]">
                        {compactDollar(g.initialValue)} → {compactDollar(g.currentValue)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-12 text-center">
              Snapshot pending or no growth flags above threshold.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
