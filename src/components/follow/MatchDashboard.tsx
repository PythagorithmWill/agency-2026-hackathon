import type { PatternMatch, SignalStrength } from "@/lib/patterns/types";

/**
 * At-a-glance KPI strip for a pattern detail page. Always renders a
 * count + severity distribution; the rest of the cards are derived
 * per pattern from the evidence array on each match.
 *
 * Keep it small — three or four data points. The full transparency
 * view lives at /transparency. This is the executive ribbon at the
 * top of /follow/[slug].
 */

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const compactDollar = (v: number) => {
  if (!isFinite(v) || v === 0) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return dollar.format(v);
};

const compactInt = (v: number) =>
  !isFinite(v) || v === 0 ? "—" : v.toLocaleString("en-CA");

const SEVERITY_COLORS: Record<SignalStrength, string> = {
  flag: "var(--color-accent-fail)",
  attention: "var(--color-accent-warn)",
  observation: "var(--color-fg-muted)",
};

type Kpi = {
  label: string;
  value: string;
  /** Optional context line under the value — used to name the entity behind a "Top X" stat. */
  subline?: string;
};

function topMatchByEvidence(
  matches: PatternMatch[],
  field: string,
): PatternMatch | null {
  if (matches.length === 0) return null;
  return matches.reduce<PatternMatch | null>((acc, m) => {
    const v = n(m.evidence.find((e) => e.field === field)?.value);
    if (acc === null) return m;
    const accV = n(acc.evidence.find((e) => e.field === field)?.value);
    return v > accV ? m : acc;
  }, null);
}

function truncate(s: string, max = 48): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function ev(m: PatternMatch, field: string): unknown {
  return m.evidence.find((e) => e.field === field)?.value ?? null;
}

function n(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

function buildKpis(patternId: string, matches: PatternMatch[]): Kpi[] {
  if (matches.length === 0) return [];
  switch (patternId) {
    case "zombie-recipients": {
      const totals = matches.map((m) => n(ev(m, "total_value")));
      const totalSilent = totals.reduce((s, x) => s + x, 0);
      const topMatch = topMatchByEvidence(matches, "total_value");
      const top = topMatch ? n(ev(topMatch, "total_value")) : 0;
      const yearsSilent = matches
        .map((m) => {
          const last = ev(m, "last_grant");
          if (typeof last !== "string") return 0;
          return (Date.now() - new Date(last).getTime()) / (365.25 * 86400000);
        })
        .filter((y) => y > 0);
      const avgYears =
        yearsSilent.length > 0
          ? yearsSilent.reduce((s, y) => s + y, 0) / yearsSilent.length
          : 0;
      return [
        { label: "Total $ silent", value: compactDollar(totalSilent) },
        {
          label: "Top recipient",
          value: compactDollar(top),
          subline: topMatch ? truncate(topMatch.subject.canonicalName) : undefined,
        },
        { label: "Avg years silent", value: avgYears > 0 ? `${avgYears.toFixed(1)} yr` : "—" },
      ];
    }
    case "ghost-capacity": {
      const totals = matches.map((m) => n(ev(m, "total_value")));
      const totalFlowing = totals.reduce((s, x) => s + x, 0);
      const topMatch = topMatchByEvidence(matches, "total_value");
      const top = topMatch ? n(ev(topMatch, "total_value")) : 0;
      const agreements = matches.reduce((s, m) => s + n(ev(m, "grant_count")), 0);
      return [
        { label: "Total $ to BN-less", value: compactDollar(totalFlowing) },
        {
          label: "Top recipient",
          value: compactDollar(top),
          subline: topMatch ? truncate(topMatch.subject.canonicalName) : undefined,
        },
        { label: "Total agreements", value: compactInt(agreements) },
      ];
    }
    case "funding-loops": {
      const loops = matches.reduce((s, m) => s + n(ev(m, "total_loops")), 0);
      const circular = matches.reduce(
        (s, m) => s + n(ev(m, "total_circular_amt")),
        0,
      );
      const topMatch = topMatchByEvidence(matches, "score");
      const topScore = topMatch ? n(ev(topMatch, "score")) : 0;
      return [
        { label: "Total loops", value: compactInt(loops) },
        { label: "Circular $ flow", value: compactDollar(circular) },
        {
          label: "Top score",
          value: topScore > 0 ? topScore.toFixed(0) : "—",
          subline: topMatch ? truncate(topMatch.subject.canonicalName) : undefined,
        },
      ];
    }
    case "sole-source-creep": {
      const totalFinal = matches.reduce(
        (s, m) => s + n(ev(m, "final_value")),
        0,
      );
      const ratios = matches
        .map((m) => n(ev(m, "growth_ratio")))
        .filter((r) => r > 0 && isFinite(r));
      const avgRatio =
        ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0;
      const totalAmendments = matches.reduce(
        (s, m) => s + n(ev(m, "amendment_count")),
        0,
      );
      return [
        { label: "Total final value", value: compactDollar(totalFinal) },
        {
          label: "Avg growth ratio",
          value: avgRatio > 0 ? `${avgRatio.toFixed(1)}×` : "—",
        },
        { label: "Total amendments", value: compactInt(totalAmendments) },
      ];
    }
    case "vendor-concentration": {
      const hhis = matches.map((m) => n(ev(m, "hhi"))).filter((h) => h > 0);
      const avgHhi =
        hhis.length > 0 ? hhis.reduce((s, h) => s + h, 0) / hhis.length : 0;
      const deptTotal = matches.reduce((s, m) => s + n(ev(m, "dept_total")), 0);
      const topShareMatch = matches.reduce<PatternMatch | null>((acc, m) => {
        const v = parseFloat(String(ev(m, "top3_share_pct")) || "0");
        if (acc === null) return m;
        const accV = parseFloat(String(ev(acc, "top3_share_pct")) || "0");
        return v > accV ? m : acc;
      }, null);
      const topShare = topShareMatch
        ? parseFloat(String(ev(topShareMatch, "top3_share_pct")) || "0")
        : 0;
      return [
        { label: "Avg HHI", value: avgHhi > 0 ? avgHhi.toFixed(0) : "—" },
        { label: "Total dept spend", value: compactDollar(deptTotal) },
        {
          label: "Worst top-3 share",
          value: topShare > 0 ? `${topShare.toFixed(1)}%` : "—",
          subline: topShareMatch
            ? `${truncate(topShareMatch.subject.canonicalName)} · top vendor: ${truncate(String(ev(topShareMatch, "top1_recipient") ?? "—"), 36)}`
            : undefined,
        },
      ];
    }
    case "related-parties": {
      const totalLinks = matches.reduce(
        (s, m) => s + n(ev(m, "source_link_count")),
        0,
      );
      const triCount = matches.filter((m) => {
        const sources = String(ev(m, "dataset_sources") ?? "").split(",");
        return sources.length >= 3;
      }).length;
      const topMatch = topMatchByEvidence(matches, "source_link_count");
      const topLinks = topMatch ? n(ev(topMatch, "source_link_count")) : 0;
      return [
        { label: "Total source records", value: compactInt(totalLinks) },
        { label: "3+ dataset entities", value: compactInt(triCount) },
        {
          label: "Top entity links",
          value: compactInt(topLinks),
          subline: topMatch ? truncate(topMatch.subject.canonicalName) : undefined,
        },
      ];
    }
    case "policy-misalignment": {
      const ratios = matches.map((m) =>
        parseFloat(String(ev(m, "ratio_actual_over_stated") ?? "0")),
      );
      const avgRatio =
        ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0;
      const annualGap = matches.reduce(
        (s, m) =>
          s +
          Math.max(
            0,
            n(ev(m, "stated_annual_commitment_cad")) -
              n(ev(m, "annual_actual_cad")),
          ),
        0,
      );
      const worstRatio = Math.min(...ratios.filter((r) => r > 0));
      return [
        {
          label: "Avg gap to stated",
          value:
            avgRatio > 0 && avgRatio < 1
              ? `${((1 - avgRatio) * 100).toFixed(0)}%`
              : "—",
        },
        { label: "Annual underspend", value: compactDollar(annualGap) },
        {
          label: "Worst priority ratio",
          value:
            isFinite(worstRatio) && worstRatio > 0
              ? `${(worstRatio * 100).toFixed(0)}%`
              : "—",
        },
      ];
    }
    case "duplicative-funding": {
      const fed = matches.reduce((s, m) => s + n(ev(m, "fed_records")), 0);
      const ab = matches.reduce((s, m) => s + n(ev(m, "ab_records")), 0);
      const topMatch = matches.reduce<PatternMatch | null>((acc, m) => {
        const v = n(ev(m, "fed_records")) + n(ev(m, "ab_records"));
        if (acc === null) return m;
        const accV = n(ev(acc, "fed_records")) + n(ev(acc, "ab_records"));
        return v > accV ? m : acc;
      }, null);
      const topOverlap = topMatch
        ? n(ev(topMatch, "fed_records")) + n(ev(topMatch, "ab_records"))
        : 0;
      return [
        { label: "Total federal records", value: compactInt(fed) },
        { label: "Total Alberta records", value: compactInt(ab) },
        {
          label: "Top entity overlap",
          value: compactInt(topOverlap),
          subline: topMatch ? truncate(topMatch.subject.canonicalName) : undefined,
        },
      ];
    }
    case "amendment-purpose-drift": {
      const sims = matches
        .map((m) => parseFloat(String(ev(m, "description_similarity") ?? "0")))
        .filter((x) => isFinite(x));
      const avgSim =
        sims.length > 0 ? sims.reduce((s, x) => s + x, 0) / sims.length : 0;
      const totalAmend = matches.reduce(
        (s, m) => s + n(ev(m, "amendment_count")),
        0,
      );
      const driftPct = avgSim > 0 ? `${((1 - avgSim) * 100).toFixed(0)}%` : "—";
      const avgAmend =
        matches.length > 0 ? totalAmend / matches.length : 0;
      return [
        { label: "Avg drift", value: driftPct },
        { label: "Total amendments", value: compactInt(totalAmend) },
        {
          label: "Avg amendments / agreement",
          value: avgAmend > 0 ? avgAmend.toFixed(1) : "—",
        },
      ];
    }
    default:
      return [];
  }
}

export function MatchDashboard({
  patternId,
  matches,
  slug,
  severityFilter,
}: {
  patternId: string;
  matches: PatternMatch[];
  slug: string;
  severityFilter: SignalStrength | null;
}) {
  const total = matches.length;
  const flag = matches.filter((m) => m.signalStrength === "flag").length;
  const attention = matches.filter((m) => m.signalStrength === "attention").length;
  const observation = matches.filter(
    (m) => m.signalStrength === "observation",
  ).length;
  const kpis = buildKpis(patternId, matches);

  if (total === 0) return null;

  return (
    <section
      aria-label="Pattern match overview"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6"
    >
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-[15px] tracking-tight">
          At-a-glance
        </h2>
        <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          {total.toLocaleString("en-CA")} {total === 1 ? "match" : "matches"} in this view
          {severityFilter && (
            <>
              {" · filtering "}
              <a
                href={`/follow/${slug}`}
                className="text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                clear filter ×
              </a>
            </>
          )}
        </div>
      </div>

      {/* Severity ribbon — chips are clickable filters */}
      <div className="mt-5">
        <SeverityRibbon
          flag={flag}
          attention={attention}
          observation={observation}
          total={total}
        />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <SeverityChip
            color={SEVERITY_COLORS.flag}
            label="Flag"
            count={flag}
            total={total}
            slug={slug}
            value="flag"
            active={severityFilter === "flag"}
          />
          <SeverityChip
            color={SEVERITY_COLORS.attention}
            label="Attention"
            count={attention}
            total={total}
            slug={slug}
            value="attention"
            active={severityFilter === "attention"}
          />
          <SeverityChip
            color={SEVERITY_COLORS.observation}
            label="Observation"
            count={observation}
            total={total}
            slug={slug}
            value="observation"
            active={severityFilter === "observation"}
          />
        </div>
      </div>

      {/* Per-pattern KPIs */}
      {kpis.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-4"
            >
              <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                {k.label}
              </div>
              <div className="mt-2 text-[20px] tabular-nums tracking-tight">
                {k.value}
              </div>
              {k.subline && (
                <div className="mt-1.5 text-[11.5px] leading-[1.4] text-[var(--color-fg-muted)] break-words">
                  {k.subline}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
        Aggregated from the matches below. Severity bands are calibrated per
        pattern; counts and dollar totals reflect this snapshot only.
      </p>
    </section>
  );
}

function SeverityRibbon({
  flag,
  attention,
  observation,
  total,
}: {
  flag: number;
  attention: number;
  observation: number;
  total: number;
}) {
  const flagPct = (flag / total) * 100;
  const attentionPct = (attention / total) * 100;
  const observationPct = (observation / total) * 100;
  return (
    <div
      className="h-2 w-full rounded-full overflow-hidden flex bg-[var(--color-bg-elev-2)]"
      aria-hidden
    >
      {flagPct > 0 && (
        <div
          style={{
            width: `${flagPct}%`,
            background: SEVERITY_COLORS.flag,
          }}
        />
      )}
      {attentionPct > 0 && (
        <div
          style={{
            width: `${attentionPct}%`,
            background: SEVERITY_COLORS.attention,
          }}
        />
      )}
      {observationPct > 0 && (
        <div
          style={{
            width: `${observationPct}%`,
            background: SEVERITY_COLORS.observation,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
}

function SeverityChip({
  color,
  label,
  count,
  total,
  slug,
  value,
  active,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
  slug: string;
  value: string;
  active: boolean;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const href = active ? `/follow/${slug}` : `/follow/${slug}?severity=${value}`;
  const disabled = count === 0;
  const className = `rounded-md border p-3 flex items-center gap-3 transition-colors ${
    active
      ? "border-[var(--color-accent)] bg-[var(--color-bg-elev-2)]"
      : disabled
        ? "border-[var(--color-border)] opacity-50"
        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elev-2)]/50"
  }`;
  const content = (
    <>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
          {label}
          {active ? " · filtering" : disabled ? "" : " · click to filter"}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[18px] tabular-nums leading-none">{count}</span>
          <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-fg-subtle)] tabular-nums">
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
    </>
  );
  if (disabled) {
    return <div className={className}>{content}</div>;
  }
  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}
