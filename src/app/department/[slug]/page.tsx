import { notFound } from "next/navigation";
import Link from "next/link";
import { computeConcentration } from "@/lib/analytics/concentration";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { AnimatedBar } from "@/components/viz/AnimatedBar";
import { AnimatedAreaChart } from "@/components/viz/AnimatedAreaChart";
import { LorenzCurve } from "@/components/viz/LorenzCurve";

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

/**
 * Department detail page. Reads from the snapshot's per-department
 * profile cache (top 15 departments). For long-tail departments, only
 * the snapshot's topDepartments summary stats are available; the page
 * gracefully degrades to those.
 */
function deptSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snap = await loadSnapshot();
  const found = snap?.topDepartments.find((d) => deptSlug(d.department) === slug);
  return { title: found ? `${found.department} — Glassbox` : "Department — Glassbox" };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const snap = await loadSnapshot();
  const dept = snap?.topDepartments.find((d) => deptSlug(d.department) === slug);
  if (!dept || !snap) notFound();

  const profile = snap.departmentProfiles[dept.department];

  const concentration =
    profile && profile.topRecipients.length > 0
      ? computeConcentration(profile.topRecipients)
      : null;

  const series = profile?.temporalSeries;
  const forecast = profile?.forecast;

  return (
    <main className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · department profile
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            {dept.department}
          </h1>
          <p className="mt-6 max-w-[720px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {compactDollar(dept.total)} in federal grants and contributions
            disbursed by this department, across {dept.agreementCount.toLocaleString("en-CA")}{" "}
            current agreements to {dept.recipientCount.toLocaleString("en-CA")} distinct recipients.
          </p>
          {!profile && (
            <p className="mt-4 max-w-[720px] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent-warn)]">
              Detailed profile not in snapshot. Showing summary stats only.
            </p>
          )}
        </div>
      </section>

      {/* KPI strip */}
      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total spend" value={compactDollar(dept.total)} />
          <Stat label="Agreements" value={dept.agreementCount.toLocaleString("en-CA")} />
          <Stat label="Recipients" value={dept.recipientCount.toLocaleString("en-CA")} />
          <Stat
            label="Programs"
            value={(profile?.topPrograms.length ?? 0).toLocaleString("en-CA")}
          />
        </div>
      </section>

      {/* Content panels */}
      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        {profile && (
          <>
            <Card
              title="Spending trajectory"
              subtitle={
                forecast
                  ? `${forecast.trend} (R² ${forecast.rSquared.toFixed(2)}). 3-year forecast with ±1.96σ band.`
                  : "Insufficient series for forecast."
              }
            >
              {series && series.points.length >= 2 ? (
                <AnimatedAreaChart
                  historical={series.points.map((p) => ({ fy: p.fy, value: p.total }))}
                  forecast={forecast?.forecast ?? []}
                  height={280}
                />
              ) : (
                <Empty />
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card
                title="Recipient concentration"
                subtitle={
                  concentration
                    ? `HHI ${concentration.hhi.toFixed(0)} · Gini ${concentration.gini.toFixed(2)} (top-25 slice)`
                    : ""
                }
              >
                {concentration ? (
                  <LorenzCurve
                    decileBreakdown={concentration.decileBreakdown}
                    gini={concentration.gini}
                  />
                ) : (
                  <Empty />
                )}
              </Card>
              <Card title="Top 25 recipients" span={2}>
                {profile.topRecipients.length > 0 ? (
                  <AnimatedBar
                    rows={profile.topRecipients.map((r) => ({
                      label: r.recipient,
                      value: r.total,
                      sublabel: `${r.agreementCount.toLocaleString("en-CA")} agreements${r.bn ? ` · BN ${r.bn}` : ""}`,
                      href: r.bn
                        ? `/recipient/${encodeURIComponent(r.bn)}`
                        : `/recipient/${encodeURIComponent(r.recipient)}`,
                    }))}
                    format="currency-compact"
                  />
                ) : (
                  <Empty />
                )}
              </Card>
            </div>

            <Card title="Top 25 programs" subtitle="By total spend within this department.">
              {profile.topPrograms.length > 0 ? (
                <AnimatedBar
                  rows={profile.topPrograms.map((p) => ({
                    label: p.program,
                    value: p.total,
                    sublabel: `${p.agreementCount.toLocaleString("en-CA")} agreements`,
                  }))}
                  format="currency-compact"
                  color="var(--color-accent-warn)"
                />
              ) : (
                <Empty />
              )}
            </Card>
          </>
        )}
      </section>

      <section className="border-t border-[var(--color-border)] py-8">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href={"/transparency/departments" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← All departments
          </Link>
          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Source: fed.grants_contributions · current amendment per record
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-2 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  span = 1,
  children,
}: {
  title: string;
  subtitle?: string;
  span?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const cs = span === 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "";
  return (
    <section
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 ${cs}`}
    >
      <h3 className="text-[15px] tracking-tight">{title}</h3>
      {subtitle && (
        <p className="mt-1 mb-4 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Empty() {
  return (
    <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-8">
      Source query returned no rows.
    </div>
  );
}
