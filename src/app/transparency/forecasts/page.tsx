import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";
import { AnimatedAreaChart } from "@/components/viz/AnimatedAreaChart";

export const metadata = { title: "Forecasts — Glassbox" };

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function ForecastsTab() {
  const snap = await loadSnapshot();
  const series = snap?.temporalSeries ?? null;
  const forecast = snap?.forecast ?? null;

  const historical = series ? series.points.map((p) => ({ fy: p.fy, value: p.total })) : [];

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · forecasts
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            Federal spending trajectory
          </h1>
          <p className="mt-4 max-w-[760px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            {forecast
              ? `The dataset shows ${forecast.trend} federal spend over ${forecast.historical.length} fiscal years (R² ${forecast.rSquared.toFixed(2)}). Forecast is ${forecast.forecast.length} years forward; bands are ±1.96σ over expanding-residual variance.`
              : "Snapshot pending — run scripts/build-snapshot.ts."}
          </p>
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
          <h3 className="text-[15px] tracking-tight mb-2">All federal spend by fiscal year</h3>
          <p className="mb-6 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Historical solid · forecast dashed · ±1.96σ band
          </p>
          {historical.length >= 2 ? (
            <AnimatedAreaChart
              historical={historical}
              forecast={forecast?.forecast ?? []}
              height={320}
            />
          ) : (
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-12 text-center">
              Insufficient series.
            </div>
          )}

          {forecast && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
              {forecast.forecast.map((p) => (
                <div
                  key={p.fy}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                    FY{p.fy}
                  </div>
                  <div className="mt-1 text-[18px] tabular-nums">
                    {compactDollar(p.predicted)}
                  </div>
                  <div className="mt-1 font-[var(--font-mono)] text-[11px] text-[var(--color-fg-muted)]">
                    {compactDollar(p.lowerBound)} … {compactDollar(p.upperBound)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {forecast && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
            <h3 className="text-[15px] tracking-tight mb-2">Method disclosure</h3>
            <p className="text-[14px] text-[var(--color-fg-muted)]">{forecast.method}</p>
            <p className="mt-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
              The dataset shows a linear regression trajectory. This is an intentionally simple
              model — disclosed up front. Read the methodology page for known caveats and the
              roadmap to a state-space model.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
