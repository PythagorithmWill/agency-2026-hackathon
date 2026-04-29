import Link from "next/link";
import { notFound } from "next/navigation";
import { listLiveDetectors } from "@/lib/patterns/detectors";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import {
  buildRecommendations,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  patternsBehind,
  type Recommendation,
} from "@/lib/recommendations/build";
import type { PatternMatch } from "@/lib/patterns/types";

export const revalidate = 1800;

const compactDollar = (v: number) => {
  if (!isFinite(v) || v === 0) return "$0";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const SEVERITY_COLOR = {
  flag: "var(--color-accent-fail)",
  attention: "var(--color-accent-warn)",
  observation: "var(--color-fg-muted)",
} as const;

const RISK_COLOR: Record<"low" | "moderate" | "high", string> = {
  high: "var(--color-accent-fail)",
  moderate: "var(--color-accent-warn)",
  low: "var(--color-fg-muted)",
};

async function loadAllRecommendations(): Promise<Recommendation[]> {
  const snap = await loadSnapshot();
  const detectors = listLiveDetectors();
  const matchesByPattern: Record<string, PatternMatch[]> = {};
  if (snap?.patternMatches) {
    for (const d of detectors) {
      const slug = d.pattern.id;
      matchesByPattern[slug] = (snap.patternMatches[slug] as PatternMatch[]) ?? [];
    }
  }
  return buildRecommendations({
    fundingLoops: matchesByPattern["funding-loops"] ?? [],
    ghostCapacity: matchesByPattern["ghost-capacity"] ?? [],
    zombieRecipients: matchesByPattern["zombie-recipients"] ?? [],
    soleSourceCreep: matchesByPattern["sole-source-creep"] ?? [],
    vendorConcentration: matchesByPattern["vendor-concentration"] ?? [],
    amendmentDrift: matchesByPattern["amendment-purpose-drift"] ?? [],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const all = await loadAllRecommendations();
  const decoded = decodeURIComponent(id);
  const rec = all.find((r) => r.id === decoded);
  return { title: rec ? `${rec.title.slice(0, 60)} — Glassbox` : "Recommendation — Glassbox" };
}

export default async function RecommendationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const all = await loadAllRecommendations();
  const rec = all.find((r) => r.id === decoded);
  if (!rec) notFound();

  const patterns = patternsBehind(rec.patternIds);
  const dependsOnRecs = rec.dependsOn
    .map((depId) => all.find((r) => r.id === depId))
    .filter((r): r is Recommendation => r !== undefined);

  const netImpact =
    rec.monetaryImpact.recoverableEstimate +
    rec.monetaryImpact.indirectAnnualCost -
    rec.monetaryImpact.oneTimeImplementationCost;

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-32 pb-16">
          <div className="flex items-baseline gap-3 flex-wrap">
            <Link
              href={"/recommendations" as never}
              className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            >
              Recommendations
            </Link>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]">/</span>
            <span
              className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em]"
              style={{ color: SEVERITY_COLOR[rec.severity] }}
            >
              ● {rec.severity}
            </span>
            <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              · {CATEGORY_LABELS[rec.category]}
            </span>
            <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              · Priority: {PRIORITY_LABELS[rec.priority]}
            </span>
          </div>
          <h1 className="mt-6 text-[clamp(40px,5.5vw,72px)] leading-[0.95] tracking-[-0.025em] font-medium">
            {rec.title}
          </h1>
          <p className="mt-6 max-w-[920px] text-[clamp(16px,1.4vw,20px)] text-[var(--color-fg-muted)] leading-[1.55]">
            {rec.justification.narrative}
          </p>
        </div>
      </section>

      {/* KPI strip */}
      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Gross at stake" value={compactDollar(rec.monetaryImpact.grossAtStake)} />
          <Stat
            label="Recoverable / prevented"
            value={compactDollar(rec.monetaryImpact.recoverableEstimate)}
            tint="var(--color-accent)"
          />
          <Stat label="Indirect annual cost of inaction" value={compactDollar(rec.monetaryImpact.indirectAnnualCost)} />
          <Stat
            label="Confidence"
            value={`${(rec.confidence.score * 100).toFixed(0)}%`}
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
        {/* Monetary impact */}
        <Panel title="Monetary impact">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Mini label="Implementation (one-time)" value={compactDollar(rec.monetaryImpact.oneTimeImplementationCost)} />
            <Mini
              label="Net Year-1 impact"
              value={compactDollar(netImpact)}
              tint={netImpact >= 0 ? "var(--color-accent)" : "var(--color-accent-warn)"}
            />
            <Mini
              label="Recovery rate"
              value={
                rec.monetaryImpact.grossAtStake > 0
                  ? `${(
                      (rec.monetaryImpact.recoverableEstimate /
                        rec.monetaryImpact.grossAtStake) *
                      100
                    ).toFixed(1)}%`
                  : "—"
              }
            />
          </div>
          <p className="mt-5 text-[13px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[920px]">
            {rec.monetaryImpact.methodologyNote}
          </p>
        </Panel>

        {/* Risk overview */}
        <Panel title="Risk overview">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            <RiskCell label="Likelihood" level={rec.riskOverview.likelihood} />
            <RiskCell label="Impact" level={rec.riskOverview.impact} />
            <Mini
              label="Composite"
              value={composite(rec.riskOverview.likelihood, rec.riskOverview.impact)}
              tint={
                composite(rec.riskOverview.likelihood, rec.riskOverview.impact) === "Critical"
                  ? "var(--color-accent-fail)"
                  : composite(rec.riskOverview.likelihood, rec.riskOverview.impact) === "Elevated"
                    ? "var(--color-accent-warn)"
                    : "var(--color-fg-muted)"
              }
            />
          </div>
          <div className="space-y-4">
            <RiskRow label="Regulatory exposure" body={rec.riskOverview.regulatoryExposure} />
            <RiskRow label="Operational risk" body={rec.riskOverview.operationalRisk} />
            <RiskRow label="Reputational risk" body={rec.riskOverview.reputationalRisk} />
          </div>
        </Panel>

        {/* Justification & audit trail */}
        <Panel title="Justification & audit trail">
          <p className="text-[13px] uppercase tracking-[0.08em] font-[var(--font-mono)] text-[var(--color-fg-subtle)] mb-3">
            {rec.justification.headline}
          </p>
          <p className="text-[14px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[920px]">
            {rec.justification.narrative}
          </p>
          {rec.justification.keyMetrics.length > 0 && (
            <div className="mt-6">
              <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-3">
                Key metrics
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rec.justification.keyMetrics.map((m, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-3"
                  >
                    <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                      {m.label}
                    </div>
                    <div className="mt-1 text-[15px] tabular-nums break-words">{m.value}</div>
                    <div className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--color-fg-subtle)]">
                      source: {m.source}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rec.evidence.length > 0 && (
            <div className="mt-6">
              <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-3">
                Source rows ({rec.evidence.length} cited)
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-[12px] font-[var(--font-mono)]">
                  <thead className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="text-left py-2">Source</th>
                      <th className="text-left py-2">Row</th>
                      <th className="text-left py-2">Field</th>
                      <th className="text-left py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.evidence.slice(0, 25).map((e, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 pr-4 text-[var(--color-fg-muted)]">{e.source}</td>
                        <td className="py-2 pr-4 truncate max-w-[260px]">{e.rowId}</td>
                        <td className="py-2 pr-4 text-[var(--color-fg-muted)]">{e.field}</td>
                        <td className="py-2 pr-4 tabular-nums">
                          {typeof e.value === "number"
                            ? e.value.toLocaleString("en-CA")
                            : String(e.value ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="mt-5 text-[13px] text-[var(--color-fg-muted)] leading-[1.6]">
            <span className="text-[var(--color-fg)]">Confidence rationale.</span>{" "}
            {rec.confidence.rationale}
          </p>
        </Panel>

        {/* Timeline & dependencies */}
        <Panel title="Timeline & dependencies">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            <Mini label="Start offset" value={`+${rec.timeline.startOffsetDays} days`} />
            <Mini label="Duration" value={`${rec.timeline.durationDays} days`} />
            <Mini label="Depends on" value={dependsOnRecs.length === 0 ? "none" : `${dependsOnRecs.length} rec${dependsOnRecs.length === 1 ? "" : "s"}`} />
          </div>
          {rec.timeline.milestones.length > 0 && (
            <div className="mt-2">
              <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-3">
                Milestones
              </div>
              <ol className="space-y-2 text-[13.5px] leading-[1.55]">
                {rec.timeline.milestones.map((m, i) => (
                  <li key={i} className="flex gap-3 items-baseline">
                    <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)] tabular-nums shrink-0 w-16">
                      D+{m.offsetDays}
                    </span>
                    <span>{m.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {dependsOnRecs.length > 0 && (
            <div className="mt-6">
              <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-3">
                Depends on
              </div>
              <ul className="space-y-2">
                {dependsOnRecs.map((dep) => (
                  <li key={dep.id}>
                    <Link
                      href={`/recommendations/${encodeURIComponent(dep.id)}` as never}
                      className="block rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-bg-elev-2)] p-3 transition-colors"
                    >
                      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                        {CATEGORY_LABELS[dep.category]} · {PRIORITY_LABELS[dep.priority]}
                      </div>
                      <div className="mt-1 text-[14px] tracking-tight">{dep.title}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* Actions */}
        {rec.actions.length > 0 && (
          <Panel title="Calibrated next steps">
            <ol className="space-y-3 text-[14px] leading-[1.6]">
              {rec.actions.map((a, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-accent)] shrink-0 mt-1 w-8">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {/* Pattern + links footer */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
          <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-3">
            Based on patterns
          </div>
          <div className="flex flex-wrap gap-3">
            {patterns.map((p) => (
              <Link
                key={p.id}
                href={`/follow/${p.id}` as never}
                className="px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] text-[13px] transition-colors"
              >
                {p.name}
              </Link>
            ))}
            {rec.links.map((l, i) => (
              <Link
                key={`l${i}`}
                href={l.href as never}
                className="px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] text-[13px] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function composite(
  l: "low" | "moderate" | "high",
  i: "low" | "moderate" | "high",
): "Routine" | "Elevated" | "Critical" {
  const score = (l === "high" ? 2 : l === "moderate" ? 1 : 0) + (i === "high" ? 2 : i === "moderate" ? 1 : 0);
  if (score >= 3) return "Critical";
  if (score >= 2) return "Elevated";
  return "Routine";
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div
        className="mt-2 text-[var(--text-display-sm)] tracking-[var(--tracking-display-sm)] tabular-nums"
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-4">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div
        className="mt-1.5 text-[18px] tabular-nums tracking-tight"
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function RiskCell({
  label,
  level,
}: {
  label: string;
  level: "low" | "moderate" | "high";
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-4">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div
        className="mt-1.5 text-[18px] tracking-tight capitalize"
        style={{ color: RISK_COLOR[level] }}
      >
        ● {level}
      </div>
    </div>
  );
}

function RiskRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-4">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--color-fg-muted)] max-w-[860px]">
        {body}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
      <h2 className="text-[15px] tracking-tight mb-5">{title}</h2>
      {children}
    </section>
  );
}
