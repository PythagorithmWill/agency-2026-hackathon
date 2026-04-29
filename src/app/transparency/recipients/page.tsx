import { describeConcentration } from "@/lib/analytics/concentration";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";
import { AnimatedBar } from "@/components/viz/AnimatedBar";
import { LorenzCurve } from "@/components/viz/LorenzCurve";

export const metadata = { title: "Recipients — Glassbox" };

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function RecipientsTab() {
  const snap = await loadSnapshot();
  const conc = snap?.concentration ?? null;

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · recipients
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            Federal funding recipients
          </h1>
          <p className="mt-4 max-w-[760px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            {conc
              ? describeConcentration(conc)
              : "Snapshot pending — run scripts/build-snapshot.ts."}
          </p>
          {snap && (
            <p className="mt-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
              Concentration computed over the top-25,000 recipients by spend (long-tail).
              Full corpus has {snap.overview.recipientCountFed.toLocaleString("en-CA")} recipients.
            </p>
          )}
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        {conc && conc.recipientCount > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Stat label="HHI (concentration index)" value={conc.hhi.toFixed(0)} sublabel={hhiBand(conc.hhi)} />
              <Stat label="Gini coefficient" value={conc.gini.toFixed(2)} sublabel="0 = equal, 1 = extreme" />
              <Stat
                label="Median agreement value"
                value={compactDollar(conc.median)}
                sublabel={`Mean ${compactDollar(conc.mean)}`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
                <h3 className="text-[15px] tracking-tight mb-4">Lorenz curve</h3>
                <LorenzCurve decileBreakdown={conc.decileBreakdown} gini={conc.gini} />
                <p className="mt-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
                  Cumulative spend share, sorted by recipient. Distance from the dashed equality
                  line is the Gini.
                </p>
              </div>
              <div className="lg:col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
                <h3 className="text-[15px] tracking-tight mb-4">Top 10 recipients</h3>
                <AnimatedBar
                  rows={conc.top10.map((r) => ({
                    label: r.recipient,
                    value: r.total,
                    sublabel: `${(r.share * 100).toFixed(2)}% of top-25k spend · ${r.agreementCount.toLocaleString("en-CA")} agreements${r.bn ? ` · BN ${r.bn}` : ""}`,
                  }))}
                  format="currency-compact"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-12 text-center font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Snapshot pending.
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-2 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] tabular-nums">
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 font-[var(--font-mono)] text-[11px] text-[var(--color-fg-muted)]">
          {sublabel}
        </div>
      )}
    </div>
  );
}

function hhiBand(hhi: number): string {
  if (hhi >= 2500) return "Concentrated";
  if (hhi >= 1500) return "Moderately concentrated";
  return "Unconcentrated";
}
