import Link from "next/link";
import { listLiveDetectors } from "@/lib/patterns/detectors";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import {
  buildRecommendations,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  patternsBehind,
  type Recommendation,
  type RecommendationCategory,
} from "@/lib/recommendations/build";
import type { PatternMatch } from "@/lib/patterns/types";

export const metadata = { title: "Recommendations — Glassbox" };

// Cache the recommendations page for 30 minutes — re-running every
// detector live on each load is expensive. The "Re-run" UI surfaced
// in a future deploy will trigger a revalidate manually.
export const revalidate = 1800;

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const PRIORITY_COLOR: Record<string, string> = {
  now: "var(--color-accent-fail)",
  next_quarter: "var(--color-accent-warn)",
  next_cycle: "var(--color-fg-muted)",
};

const SEVERITY_COLOR: Record<string, string> = {
  flag: "var(--color-accent-fail)",
  attention: "var(--color-accent-warn)",
  observation: "var(--color-fg-muted)",
};

interface DetectorResult {
  patternId: string;
  matches: PatternMatch[];
  error?: string;
}

/**
 * Load detector matches. Tries the snapshot first (instant, no DB);
 * falls back to live detection only if the snapshot doesn't have
 * cached results. The build-snapshot.ts pipeline runs every detector
 * sequentially under the long pool — much more reliable than running
 * 6 detectors in parallel at request time.
 */
async function loadDetectorResults(): Promise<DetectorResult[]> {
  const snap = await loadSnapshot();
  const detectors = listLiveDetectors();

  if (snap?.patternMatches && Object.keys(snap.patternMatches).length > 0) {
    return detectors.map((d) => {
      const slug = d.pattern.id;
      const cached = snap.patternMatches[slug] as PatternMatch[] | undefined;
      const error = snap.patternMatchErrors?.[slug];
      return {
        patternId: slug,
        matches: cached ?? [],
        error,
      };
    });
  }

  // Live fallback — only when the snapshot is missing or stale.
  const settled = await Promise.allSettled(
    detectors.map(async (d) => ({
      patternId: d.pattern.id,
      matches: await d.detect({ limit: 50 }),
    })),
  );
  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      patternId: detectors[i].pattern.id,
      matches: [],
      error: (s.reason as Error)?.message ?? "detection_failed",
    };
  });
}

export default async function RecommendationsPage() {
  const detectorResults = await loadDetectorResults();

  const matchesByPattern = Object.fromEntries(
    detectorResults.map((r) => [r.patternId, r.matches]),
  );

  const recommendations = buildRecommendations({
    fundingLoops: matchesByPattern["funding-loops"] ?? [],
    ghostCapacity: matchesByPattern["ghost-capacity"] ?? [],
    zombieRecipients: matchesByPattern["zombie-recipients"] ?? [],
    soleSourceCreep: matchesByPattern["sole-source-creep"] ?? [],
    vendorConcentration: matchesByPattern["vendor-concentration"] ?? [],
    amendmentDrift: matchesByPattern["amendment-purpose-drift"] ?? [],
  });

  const totalDollars = recommendations.reduce((s, r) => s + r.dollarsAtStake, 0);
  const totalMatches = recommendations.reduce((s, r) => s + r.matchCount, 0);
  const byPriority = {
    now: recommendations.filter((r) => r.priority === "now"),
    next_quarter: recommendations.filter((r) => r.priority === "next_quarter"),
    next_cycle: recommendations.filter((r) => r.priority === "next_cycle"),
  };
  const errors = detectorResults.filter((r) => r.error);

  return (
    <main className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-32 pb-16">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · decision intelligence
          </div>
          <h1 className="mt-6 text-[clamp(56px,8vw,108px)] leading-[0.95] tracking-[-0.04em] font-medium">
            Recommendations<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-6 max-w-[820px] text-[clamp(18px,1.6vw,22px)] italic text-[var(--color-fg-muted)] leading-[1.45]">
            What the dataset suggests the funder might do — calibrated
            actions distilled from {totalMatches.toLocaleString("en-CA")}{" "}
            live pattern matches across the federal corpus and Alberta
            provincial sources, prioritised by severity and dollars at stake.
          </p>
          <p className="mt-4 max-w-[820px] font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
            Glassbox observes; it does not direct. Each recommendation cites
            its underlying pattern matches and source rows. The funder
            decides the response.
          </p>
        </div>
      </section>

      {/* KPI strip */}
      <section className="mx-auto max-w-[1280px] px-6 pt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Recommendations" value={recommendations.length.toLocaleString("en-CA")} />
          <Stat label="Underlying matches" value={totalMatches.toLocaleString("en-CA")} />
          <Stat label="Dollars at stake" value={compactDollar(totalDollars)} />
          <Stat
            label="Detectors live"
            value={`${detectorResults.length - errors.length}/${detectorResults.length}`}
          />
        </div>
        {errors.length > 0 && (
          <div className="mt-4 rounded-md border border-[var(--color-accent-warn)]/40 bg-[var(--color-bg-elev-1)] p-4 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            <span className="text-[var(--color-accent-warn)]">Notice ·</span>{" "}
            {errors.length} detector{errors.length === 1 ? "" : "s"} returned
            an error this run ({errors.map((e) => e.patternId).join(", ")}) —
            recommendations from those patterns are excluded until the next
            run completes.
          </div>
        )}
      </section>

      {/* Priority sections */}
      <section className="mx-auto max-w-[1280px] px-6 py-12 space-y-12">
        <PrioritySection
          title="Now"
          subtitle="Highest severity or largest dollars at stake. Surface to the audit committee or program lead."
          color={PRIORITY_COLOR.now}
          recs={byPriority.now}
        />
        <PrioritySection
          title="Next quarter"
          subtitle="Attention-band patterns and mid-tier dollar exposure. Add to the next review cycle."
          color={PRIORITY_COLOR.next_quarter}
          recs={byPriority.next_quarter}
        />
        <PrioritySection
          title="Next cycle"
          subtitle="Observation-band patterns. Background monitoring; act if the trend persists."
          color={PRIORITY_COLOR.next_cycle}
          recs={byPriority.next_cycle}
        />
      </section>

      {/* Methodology footer */}
      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[1280px] px-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
          <div>
            <h3 className="text-[15px] tracking-tight text-[var(--color-fg)]">
              How recommendations are built
            </h3>
            <p className="mt-2">
              Glassbox runs every live pattern detector against the source
              corpus, aggregates the matches, and emits structured
              recommendations through{" "}
              <code className="font-[var(--font-mono)] text-[12px] mx-0.5 px-1 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
                src/lib/recommendations/build.ts
              </code>
              . Priority is computed from severity (flag / attention /
              observation) × dollars-at-stake. Each recommendation cites its
              underlying matches and sources — the trail walks back to{" "}
              <code className="font-[var(--font-mono)] text-[12px] mx-0.5 px-1 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
                fed.grants_contributions
              </code>{" "}
              and{" "}
              <code className="font-[var(--font-mono)] text-[12px] mx-0.5 px-1 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
                cra.loop_universe
              </code>{" "}
              row by row.
            </p>
          </div>
          <div>
            <h3 className="text-[15px] tracking-tight text-[var(--color-fg)]">
              Calibrated language discipline
            </h3>
            <p className="mt-2">
              Recommendations frame as observations and options — never as
              directives or causal claims. &ldquo;The dataset suggests
              reviewing X&rdquo; rather than &ldquo;X is fraud.&rdquo;
              Severity bands describe match strength, not proven misconduct.
              Read{" "}
              <Link href={"/methodology" as never} className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                the methodology
              </Link>{" "}
              for the full calibration rules.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PrioritySection({
  title,
  subtitle,
  color,
  recs,
}: {
  title: string;
  subtitle: string;
  color: string;
  recs: Recommendation[];
}) {
  if (recs.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6">
        <h2
          className="text-[clamp(28px,3vw,42px)] tracking-[-0.025em] font-medium"
          style={{ color }}
        >
          {title}
        </h2>
        <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          {recs.length} {recs.length === 1 ? "recommendation" : "recommendations"}
        </div>
      </div>
      <p className="text-[14px] text-[var(--color-fg-muted)] mb-6 max-w-[760px]">
        {subtitle}
      </p>
      <ol className="space-y-4">
        {recs.map((r, i) => (
          <RecommendationCard key={r.id} rec={r} index={i + 1} />
        ))}
      </ol>
    </div>
  );
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const patterns = patternsBehind(rec.patternIds);
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <div className="flex items-baseline gap-4">
          <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
          <span
            className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em]"
            style={{ color: SEVERITY_COLOR[rec.severity] }}
          >
            ● {rec.severity}
          </span>
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            {CATEGORY_LABELS[rec.category as RecommendationCategory]}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            {PRIORITY_LABELS[rec.priority]}
          </span>
          <span className="font-[var(--font-mono)] text-[15px] tabular-nums text-[var(--color-fg)]">
            {compactDollar(rec.dollarsAtStake)}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-[20px] leading-[1.3] tracking-tight">
        {rec.title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[920px]">
        {rec.body}
      </p>

      {rec.actions.length > 0 && (
        <div className="mt-5">
          <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] mb-2">
            Calibrated next steps
          </div>
          <ol className="space-y-2 text-[13.5px] text-[var(--color-fg)] leading-[1.55]">
            {rec.actions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)] shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-baseline justify-between gap-3">
        <div className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]">
          Based on{" "}
          {patterns.map((p, i) => (
            <span key={p.id}>
              <Link
                href={`/follow/${p.id}` as never}
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                {p.name}
              </Link>
              {i < patterns.length - 1 ? " · " : ""}
            </span>
          ))}{" "}
          · {rec.matchCount} match{rec.matchCount === 1 ? "" : "es"} cited
        </div>
        <div className="flex flex-wrap gap-3">
          {rec.links.map((l, i) => (
            <Link
              key={i}
              href={l.href as never}
              className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent)] hover:underline underline-offset-4"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </li>
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
