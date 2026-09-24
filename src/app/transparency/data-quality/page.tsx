import Link from "next/link";
import { loadDataQualityScorecard, type DqIssue } from "@/lib/analytics/dataQuality";
import { DashboardTabs } from "@/components/transparency/DashboardTabs";

export const metadata = { title: "Data quality scorecard — Glassbox" };

const FAMILY: Record<DqIssue["family"], { label: string; corpus: string }> = {
  F: { label: "F · Federal grants & contributions", corpus: "fed.grants_contributions" },
  C: { label: "C · CRA registered charities", corpus: "cra.*" },
  A: { label: "A · Alberta grants, contracts & sole-source", corpus: "ab.*" },
};
const FAMILY_ORDER: DqIssue["family"][] = ["F", "C", "A"];

const STATUS: Record<DqIssue["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "var(--color-accent-warn)" },
  mitigated: { label: "Mitigated", color: "var(--color-accent)" },
  resolved: { label: "Resolved", color: "var(--color-fg-subtle)" },
};

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const compactDollar = (v: number) => {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return dollar.format(v);
};

export default async function DataQualityTab() {
  let computedAt: string | null = null;
  let issues: DqIssue[] = [];
  let loadError: string | null = null;
  try {
    const card = await loadDataQualityScorecard();
    computedAt = card.computedAt;
    issues = card.issues;
  } catch (e) {
    loadError = (e as Error).message;
    console.warn("[transparency/data-quality] scorecard read failed:", loadError);
  }

  const active = issues.filter((i) => i.status === "active").length;
  const mitigated = issues.filter((i) => i.status === "mitigated").length;
  const resolved = issues.filter((i) => i.status === "resolved").length;

  return (
    <main className="min-h-screen pt-16">
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-20 pb-8">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · data quality scorecard
          </div>
          <h1 className="mt-3 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] leading-[0.95]">
            What the published data can and cannot support
          </h1>
          <p className="mt-4 max-w-[760px] text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
            Each row below is a documented property of the source datasets as published —
            duplicate rows, cumulative amendment values, missing identifiers, roll-up records.
            These are characteristics of the data, not findings about any recipient, department
            or program. Every canonical query in Glassbox applies the listed guard; the scorecard
            records how much of the corpus each guard touches.
          </p>
          <p className="mt-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            {computedAt
              ? `Scorecard computed ${new Date(computedAt).toUTCString()}`
              : "Scorecard not yet computed"}
            {issues.length > 0 && (
              <>
                {" · "}
                {issues.length} issues · {active} active · {mitigated} mitigated · {resolved} resolved
              </>
            )}
          </p>
        </div>
      </section>
      <DashboardTabs />

      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 space-y-8">
        {issues.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-10 text-center">
            <h2 className="text-[15px] tracking-tight">Snapshot pending</h2>
            <p className="mt-3 max-w-[560px] mx-auto text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
              The data-quality scorecard is produced by the derived-table refresh. Run{" "}
              <code className="font-[var(--font-mono)] text-[12px] px-1.5 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
                npx tsx scripts/refresh-derived.ts
              </code>{" "}
              and reload this page. The documented landmines are listed on the{" "}
              <Link
                href={"/methodology" as never}
                className="text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                methodology page
              </Link>{" "}
              in the meantime.
            </p>
          </div>
        ) : (
          FAMILY_ORDER.map((fam) => {
            const rows = issues
              .filter((i) => i.family === fam)
              .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            if (rows.length === 0) return null;
            return (
              <div
                key={fam}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-baseline justify-between gap-4 flex-wrap">
                  <h2 className="text-[15px] tracking-tight">{FAMILY[fam].label}</h2>
                  <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                    {FAMILY[fam].corpus} · {rows.length} {rows.length === 1 ? "issue" : "issues"}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-[13px]">
                    <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                      <tr>
                        <th className="text-left py-2.5 px-6 w-[64px]">ID</th>
                        <th className="text-left py-2.5 pr-4">Issue</th>
                        <th className="text-right py-2.5 pr-4 whitespace-nowrap">Rows affected</th>
                        <th className="text-right py-2.5 pr-4 whitespace-nowrap">Dollars affected</th>
                        <th className="text-left py-2.5 pr-4">Status</th>
                        <th className="text-left py-2.5 pr-6">Guard applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => (
                        <tr
                          key={i.id}
                          className="border-b border-[var(--color-border)] last:border-0 align-top"
                        >
                          <td className="py-3 px-6 font-[var(--font-mono)] text-[12px] text-[var(--color-accent-warn)] whitespace-nowrap">
                            {i.id}
                          </td>
                          <td className="py-3 pr-4 max-w-[360px]">
                            <div className="text-[var(--color-fg)]">{i.title}</div>
                            <div className="mt-1 text-[12.5px] leading-[1.5] text-[var(--color-fg-muted)]">
                              {i.description}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right font-[var(--font-mono)] tabular-nums whitespace-nowrap">
                            {i.count != null ? i.count.toLocaleString("en-CA") : "—"}
                          </td>
                          <td className="py-3 pr-4 text-right font-[var(--font-mono)] tabular-nums whitespace-nowrap">
                            {i.dollars != null ? compactDollar(i.dollars) : "—"}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            <StatusPill status={i.status} />
                          </td>
                          <td className="py-3 pr-6 font-[var(--font-mono)] text-[12px] leading-[1.5] text-[var(--color-fg-muted)] max-w-[320px]">
                            {i.guard}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}

        <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed max-w-[860px]">
          Counts and dollars are the portion of each source table touched by the guard, measured
          at refresh time. &ldquo;Active&rdquo; means the property is present in the published data
          and guarded at query time; &ldquo;mitigated&rdquo; means a canonical table removes it
          upstream of every query; &ldquo;resolved&rdquo; means the publisher corrected it. None of
          these rows describe the conduct of any entity named in the corpus.
        </div>
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: DqIssue["status"] }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em]"
      style={{ color: s.color }}
    >
      <span className="block h-[6px] w-[6px] rounded-full" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}
