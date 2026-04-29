import { notFound } from "next/navigation";
import Link from "next/link";
import {
  loadRecipientProfile,
  loadRecipientByDepartment,
  loadRecipientAgreements,
  loadTemporalSeriesFed,
  loadGoldenRecord,
  type GoldenRecordSummary,
} from "@/lib/analytics/queries";
import { AnimatedBar } from "@/components/viz/AnimatedBar";
import { AnimatedAreaChart } from "@/components/viz/AnimatedAreaChart";

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

export async function generateMetadata({ params }: { params: Promise<{ bn: string }> }) {
  const { bn } = await params;
  const decoded = decodeURIComponent(bn);
  const profile = await loadRecipientProfile(decoded).catch(() => null);
  if (profile) return { title: `${profile.legalName} — Glassbox` };
  const golden = await loadGoldenRecord(decoded).catch(() => null);
  return { title: golden ? `${golden.canonicalName} — Glassbox` : "Recipient — Glassbox" };
}

export default async function RecipientPage({
  params,
}: {
  params: Promise<{ bn: string }>;
}) {
  const { bn } = await params;
  const identifier = decodeURIComponent(bn);

  // Try federal-corpus lookup first.
  const [profileR, byDeptR, agreementsR, seriesR] = await Promise.allSettled([
    loadRecipientProfile(identifier),
    loadRecipientByDepartment(identifier),
    loadRecipientAgreements(identifier, 50),
    loadTemporalSeriesFed({ recipientBn: /^\d{9,}/.test(identifier) ? identifier : null }),
  ]);

  const profile = profileR.status === "fulfilled" ? profileR.value : null;
  const byDept = byDeptR.status === "fulfilled" ? byDeptR.value : [];
  const agreements = agreementsR.status === "fulfilled" ? agreementsR.value : [];
  const series = seriesR.status === "fulfilled" ? seriesR.value : null;

  if (profile) {
    return (
      <FederalRecipientView
        profile={profile}
        byDept={byDept}
        agreements={agreements}
        series={series}
      />
    );
  }

  // Federal lookup empty — fall back to the cross-dataset canonical record.
  // Surfaces CRA-only (charity) and AB-only entities reached via funding-loop
  // matches, ghost-capacity matches, etc.
  const golden = await loadGoldenRecord(identifier).catch(() => null);
  if (!golden) notFound();
  return <GoldenRecordView golden={golden} identifier={identifier} />;
}

/* ─── Federal-corpus view (existing behaviour) ───────────────────── */

type FedProfile = NonNullable<Awaited<ReturnType<typeof loadRecipientProfile>>>;
type FedByDept = Awaited<ReturnType<typeof loadRecipientByDepartment>>;
type FedAgreements = Awaited<ReturnType<typeof loadRecipientAgreements>>;
type FedSeries = Awaited<ReturnType<typeof loadTemporalSeriesFed>>;

function FederalRecipientView({
  profile,
  byDept,
  agreements,
  series,
}: {
  profile: FedProfile;
  byDept: FedByDept;
  agreements: FedAgreements;
  series: FedSeries | null;
}) {
  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · recipient profile · federal
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            {profile.legalName}
          </h1>
          <div className="mt-3 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] flex flex-wrap gap-x-6 gap-y-1">
            {profile.bn && <span>BN {profile.bn}</span>}
            {profile.province && <span>Province · {profile.province}</span>}
          </div>
          <p className="mt-6 max-w-[720px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows {compactDollar(profile.totalReceived)} in federal grants and
            contributions received across {profile.agreementCount.toLocaleString("en-CA")} current
            agreements from {profile.departmentCount.toLocaleString("en-CA")} departments
            {profile.fyRange.end > 0
              ? `, FY${profile.fyRange.start}–FY${profile.fyRange.end}.`
              : "."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total received" value={compactDollar(profile.totalReceived)} />
          <Stat label="Agreements" value={profile.agreementCount.toLocaleString("en-CA")} />
          <Stat label="Departments" value={profile.departmentCount.toLocaleString("en-CA")} />
          <Stat label="Programs" value={profile.programCount.toLocaleString("en-CA")} />
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        <Card
          title="Receiving trajectory"
          subtitle="Federal money received, by fiscal year of agreement start date."
        >
          {series && series.points.length >= 2 ? (
            <AnimatedAreaChart
              historical={series.points.map((p) => ({ fy: p.fy, value: p.total }))}
              forecast={[]}
              height={240}
              showLegend={false}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="By funding department">
          {byDept.length > 0 ? (
            <AnimatedBar
              rows={byDept.map((d) => ({
                label: d.department,
                value: d.total,
                sublabel: `${d.agreementCount.toLocaleString("en-CA")} agreements`,
              }))}
              format="currency-compact"
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Top 50 agreements" subtitle="Sorted by current value (descending).">
          {agreements.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-[13px]">
                <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="text-left py-2">Department</th>
                    <th className="text-left py-2">Program</th>
                    <th className="text-right py-2">Value</th>
                    <th className="text-left py-2 pl-4">Start</th>
                    <th className="text-left py-2 pl-4">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((a) => (
                    <tr
                      key={a.recordId}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elev-2)]/40"
                    >
                      <td className="py-2 pr-4 max-w-[260px] truncate text-[var(--color-fg-muted)]">
                        {a.department}
                      </td>
                      <td className="py-2 pr-4 max-w-[280px] truncate">{a.program ?? "—"}</td>
                      <td className="py-2 pr-4 text-right font-[var(--font-mono)] tabular-nums">
                        {dollar.format(a.value)}
                      </td>
                      <td className="py-2 pl-4 font-[var(--font-mono)] text-[var(--color-fg-muted)]">
                        {a.startDate?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="py-2 pl-4 font-[var(--font-mono)] text-[11px]">
                        <Link
                          href={`/record/fed/${encodeURIComponent(a.recordId)}` as never}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          {a.recordId}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
      </section>

      <RecipientFooter />
    </main>
  );
}

/* ─── Cross-dataset (golden record) fallback view ────────────────── */

function GoldenRecordView({
  golden,
  identifier,
}: {
  golden: GoldenRecordSummary;
  identifier: string;
}) {
  const cra = (golden.craProfile ?? {}) as Record<string, unknown>;
  const fed = (golden.fedProfile ?? {}) as Record<string, unknown>;
  const ab = (golden.abProfile ?? {}) as Record<string, unknown>;

  const totalCra = Number(cra.total_revenue ?? cra.total_received ?? 0) || 0;
  const totalFed = Number(fed.total_grants ?? fed.total_received ?? 0) || 0;
  const totalAb = Number(ab.total_grants ?? ab.total_received ?? 0) || 0;
  const total = totalCra + totalFed + totalAb;

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · recipient profile · cross-dataset
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            {golden.canonicalName}
          </h1>
          <div className="mt-3 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] flex flex-wrap gap-x-6 gap-y-1">
            {golden.entityType && <span>Type · {golden.entityType}</span>}
            {golden.bnRoot && <span>BN root · {golden.bnRoot}</span>}
            {golden.confidence > 0 && (
              <span>Match confidence · {(golden.confidence * 100).toFixed(0)}%</span>
            )}
          </div>
          <p className="mt-6 max-w-[760px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            The dataset shows this entity in {golden.datasetSources.length}{" "}
            {golden.datasetSources.length === 1 ? "source" : "sources"} (
            {golden.datasetSources.join(", ")}). Identifier looked up:{" "}
            <code className="font-[var(--font-mono)] text-[13px] text-[var(--color-accent)]">
              {identifier}
            </code>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total across sources" value={compactDollar(total)} />
          <Stat
            label="Source link count"
            value={Object.values(golden.sourceSummary).reduce((s, n) => s + Number(n || 0), 0).toLocaleString("en-CA")}
          />
          <Stat label="BN variants" value={golden.bnVariants.length.toLocaleString("en-CA")} />
          <Stat
            label="Aliases"
            value={golden.aliases.length.toLocaleString("en-CA")}
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        <Card
          title="Source breakdown"
          subtitle="Per-dataset record counts for this entity."
        >
          {Object.keys(golden.sourceSummary).length > 0 ? (
            <AnimatedBar
              rows={Object.entries(golden.sourceSummary).map(([k, n]) => ({
                label: k,
                value: Number(n) || 0,
                sublabel: `${Number(n).toLocaleString("en-CA")} records`,
              }))}
              format="number"
            />
          ) : (
            <Empty />
          )}
        </Card>

        {golden.craProfile && (
          <Card title="CRA T3010 profile">
            <PreJson value={golden.craProfile} />
          </Card>
        )}

        {golden.fedProfile && (
          <Card title="Federal grants profile">
            <PreJson value={golden.fedProfile} />
          </Card>
        )}

        {golden.abProfile && (
          <Card title="Alberta provincial profile">
            <PreJson value={golden.abProfile} />
          </Card>
        )}

        {golden.bnVariants.length > 0 && (
          <Card title="Known BN variants" subtitle="All business-number forms recorded for this entity.">
            <ul className="flex flex-wrap gap-2">
              {golden.bnVariants.map((v) => (
                <li
                  key={v}
                  className="font-[var(--font-mono)] text-[12px] px-2.5 py-1 rounded-md bg-[var(--color-bg-elev-2)] border border-[var(--color-border)]"
                >
                  {v}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <RecipientFooter />
    </main>
  );
}

function PreJson({ value }: { value: Record<string, unknown> }) {
  const lines = Object.entries(value).map(([k, v]) => ({
    k,
    v: typeof v === "object" ? JSON.stringify(v) : String(v ?? "—"),
  }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
      {lines.map(({ k, v }) => (
        <div key={k} className="border-b border-[var(--color-border)] py-2">
          <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            {k}
          </div>
          <div className="mt-1 font-[var(--font-mono)] text-[12px] text-[var(--color-fg)] break-words">
            {v.length > 240 ? v.slice(0, 240) + "…" : v}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecipientFooter() {
  return (
    <section className="border-t border-[var(--color-border)] py-8">
      <div className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-baseline justify-between gap-4">
        <Link
          href={"/transparency/recipients" as never}
          className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          ← Recipient concentration
        </Link>
        <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          Source: fed.grants_contributions + general.entity_golden_records
        </div>
      </div>
    </section>
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
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
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
