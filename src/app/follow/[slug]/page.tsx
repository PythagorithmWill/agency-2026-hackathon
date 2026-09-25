import { notFound } from "next/navigation";
import Link from "next/link";
import { getPattern, TRACE_ATTRIBUTION_LINE } from "@/lib/patterns/registry";
import { getDetector } from "@/lib/patterns/detectors";
import {
  loadPatternMatches,
  loadPatternFilters,
  type PatternMatchRow,
} from "@/lib/patterns/store";
import type { SignalStrength } from "@/lib/patterns/types";
import { PatternStatusPill } from "@/components/follow/PatternStatusPill";
import { MatchDashboard, type DashboardMatch } from "@/components/follow/MatchDashboard";
import { MatchFilterBar } from "@/components/follow/MatchFilterBar";
import { MatchPagination } from "@/components/follow/MatchPagination";
import { EvidenceStrengthMeter } from "@/components/follow/EvidenceStrengthMeter";
import { MatchObservations } from "@/components/follow/MatchObservations";
import {
  FOLLOW_PAGE_SIZE,
  followHref,
  parseFy,
  parsePage,
  parseStrength,
  parseText,
  type FollowQuery,
} from "@/components/follow/query";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPattern(slug);
  return { title: p ? `${p.name} — Glassbox` : "Pattern — Glassbox" };
}

type Severity = PatternMatchRow["severity"];

const SEV_COLOR: Record<Severity, string> = {
  low: "var(--color-fg-muted)",
  medium: "var(--color-accent-warn)",
  high: "var(--color-accent-fail)",
  critical: "var(--color-accent-fail)",
};

/**
 * The store's four-band severity (low/medium/high/critical) collapses to
 * the three calibrated bands the dashboard ribbon and legend already use:
 * low → observation, medium → attention, high + critical → flag.
 */
function toSignal(sev: Severity): SignalStrength {
  if (sev === "low") return "observation";
  if (sev === "medium") return "attention";
  return "flag";
}

function toDashboardMatch(r: PatternMatchRow): DashboardMatch {
  return {
    subject: r.subject,
    evidence: r.evidence,
    signalStrength: toSignal(r.severity),
  };
}

type SearchParams = {
  severity?: string;
  page?: string;
  dept?: string;
  prov?: string;
  fy?: string;
  strength?: string;
};

export default async function PatternDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const severityFilter =
    sp.severity === "flag" || sp.severity === "attention" || sp.severity === "observation"
      ? sp.severity
      : null;
  const pattern = getPattern(slug);
  if (!pattern) notFound();

  const query: FollowQuery = {
    page: parsePage(sp.page),
    dept: parseText(sp.dept),
    prov: parseText(sp.prov, 8),
    fy: parseFy(sp.fy),
    strength: parseStrength(sp.strength),
  };
  const page = query.page ?? 1;
  // Non-severity params, serialised once so the dashboard chips can keep them.
  const baseQuery = followHref(slug, query).split("?")[1] ?? "";

  const detector = getDetector(slug);
  let rows: PatternMatchRow[] = [];
  let total = 0;
  let source: "table" | "snapshot" = "snapshot";
  let filters: Awaited<ReturnType<typeof loadPatternFilters>> = {
    departments: [],
    provinces: [],
    fyRange: null,
  };
  let detectorError: string | null = null;
  if (detector) {
    try {
      const [res, f] = await Promise.all([
        loadPatternMatches({
          patternId: slug,
          limit: FOLLOW_PAGE_SIZE,
          offset: (page - 1) * FOLLOW_PAGE_SIZE,
          department: query.dept,
          province: query.prov,
          fyFrom: query.fy,
          minStrength: query.strength,
        }),
        loadPatternFilters(slug).catch(() => ({
          departments: [],
          provinces: [],
          fyRange: null,
        })),
      ]);
      rows = res.rows;
      total = res.total;
      source = res.source;
      filters = f;
    } catch (e) {
      detectorError = (e as Error).message;
    }
  }

  const hasFilters =
    source === "table" &&
    (filters.departments.length > 0 || filters.provinces.length > 0 || filters.fyRange !== null);
  const anyFilterActive =
    !!query.dept || !!query.prov || query.fy != null || (query.strength ?? 0) > 0;
  const pages = Math.max(1, Math.ceil(total / FOLLOW_PAGE_SIZE));
  const outOfRange = total > 0 && page > pages;
  const dashboardRows = rows.map(toDashboardMatch);
  const visibleRows = severityFilter
    ? rows.filter((r) => toSignal(r.severity) === severityFilter)
    : rows;
  const computedAt = rows[0]?.computedAt ?? null;

  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6 pt-20 sm:pt-32 pb-12 sm:pb-16">
          <div className="flex items-baseline gap-3 flex-wrap">
            <Link
              href={"/follow" as never}
              className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            >
              Follow the money
            </Link>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]">/</span>
            <PatternStatusPill status={pattern.status} />
            {pattern.challenge && (
              <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                · Challenge #{pattern.challenge}
              </span>
            )}
          </div>
          <h1 className="mt-6 text-[clamp(40px,9vw,128px)] leading-[0.95] tracking-[-0.04em] font-medium">
            {pattern.name}<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-8 max-w-[860px] text-[clamp(18px,1.7vw,24px)] italic text-[var(--color-fg-muted)] leading-[1.4]">
            {pattern.definition}
          </p>
          <div className="mt-8 max-w-[860px] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] leading-relaxed">
            <span className="text-[var(--color-fg-muted)]">Detection signal · </span>
            {pattern.signal}
          </div>
          {pattern.attribution === "TRACE" && (
            <div className="mt-3 max-w-[860px] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
              {TRACE_ATTRIBUTION_LINE}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 space-y-8">
        {detector && hasFilters && (
          <MatchFilterBar
            slug={slug}
            current={query}
            departments={filters.departments}
            provinces={filters.provinces}
            fyRange={filters.fyRange}
          />
        )}
        {detector && rows.length > 0 && (
          <MatchDashboard
            patternId={pattern.id}
            matches={dashboardRows}
            slug={slug}
            severityFilter={severityFilter}
            baseQuery={baseQuery}
            scopeLabel={
              total > rows.length
                ? `${rows.length.toLocaleString("en-CA")} of ${total.toLocaleString("en-CA")} matches on this page`
                : undefined
            }
          />
        )}
        {detector && rows.length > 0 && <SeverityLegend pattern={pattern} />}
        {detector ? (
          detectorError ? (
            <DetectorErrorPanel error={detectorError} />
          ) : outOfRange ? (
            <OutOfRangePanel slug={slug} query={query} pages={pages} />
          ) : rows.length > 0 ? (
            <MatchList
              rows={visibleRows}
              total={total}
              page={page}
              severityFilter={severityFilter}
              slug={slug}
              query={query}
              computedAt={computedAt}
              source={source}
            />
          ) : (
            <NoMatchesPanel filtered={anyFilterActive} slug={slug} />
          )
        ) : (
          <PendingPanel pattern={pattern} />
        )}
        {detector && rows.length > 0 && <RecommendedActions pattern={pattern} />}
      </section>

      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href={"/follow" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← All patterns
          </Link>
          <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] text-right">
            <div>
              Attribution: {pattern.attribution === "TRACE" ? "Alberta TRACE methodology" : "Glassbox-native"}
            </div>
            {detector && (
              <div className="mt-1">
                Source ·{" "}
                {source === "table"
                  ? "live pattern_matches table"
                  : "static analytics snapshot (filters unavailable)"}
                {computedAt && ` · computed ${new Date(computedAt).toUTCString()}`}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function MatchList({
  rows,
  total,
  page,
  severityFilter,
  slug,
  query,
  computedAt,
  source,
}: {
  rows: PatternMatchRow[];
  total: number;
  page: number;
  severityFilter: SignalStrength | null;
  slug: string;
  query: FollowQuery;
  computedAt: string | null;
  source: "table" | "snapshot";
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-10 text-center">
        <h3 className="text-[15px] tracking-tight">
          No {severityFilter ?? ""} matches on this page.
        </h3>
        <p className="mt-3 max-w-[520px] mx-auto text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
          The severity filter you selected has no matches on this page of results.{" "}
          <Link
            href={followHref(slug, query) as never}
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Clear the severity filter →
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="text-[20px] tracking-tight">
          {total.toLocaleString("en-CA")} {total === 1 ? "match" : "matches"}
          {total > FOLLOW_PAGE_SIZE && (
            <span className="ml-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
              · page {page}
            </span>
          )}
          {severityFilter && (
            <span className="ml-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
              · severity = {severityFilter} (this page)
            </span>
          )}
        </h2>
        <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
          {source === "table" ? "Live table" : "Snapshot"}
          {computedAt && ` · computed ${new Date(computedAt).toUTCString()}`}
        </div>
      </div>
      <ul className="space-y-3">
        {rows.map((m, idx) => (
          <li
            key={`${m.matchId}#${idx}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5 hover:border-[var(--color-border-strong)] transition-colors"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[16px] tracking-tight truncate">
                {m.subject.canonicalName}
              </h3>
              <span
                className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] whitespace-nowrap"
                style={{ color: SEV_COLOR[m.severity] }}
              >
                {m.severity}
              </span>
            </div>
            <div className="mt-1 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              {m.subject.type} · {m.subject.id}
              {m.department && ` · ${m.department}`}
              {m.province && ` · ${m.province}`}
              {m.fiscalYear != null && ` · FY ${m.fiscalYear}`}
            </div>
            <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
              {m.calibratedSummary}
            </p>
            <div className="mt-3">
              <EvidenceStrengthMeter value={m.evidenceStrength} />
            </div>
            {m.benignNote && (
              <p className="mt-3 text-[13px] leading-[1.5] text-[var(--color-fg-muted)] border-l-2 border-[var(--color-border-strong)] pl-3">
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                  Why this may be benign ·{" "}
                </span>
                {m.benignNote}
              </p>
            )}
            <div className="mt-3 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
              {m.evidence.length} cited fields from source records
            </div>
            <MatchObservations patternId={m.patternId} evidence={m.evidence} />
            {m.subject.type === "agreement" && (
              <Link
                href={`/record/fed/${encodeURIComponent(m.subject.id)}` as never}
                className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline"
              >
                View source record →
              </Link>
            )}
            {m.subject.type === "recipient" && (
              <Link
                href={`/recipient/${encodeURIComponent(m.subject.id)}` as never}
                className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline"
              >
                View recipient profile →
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <MatchPagination slug={slug} query={query} page={page} total={total} />
      </div>
    </div>
  );
}

function OutOfRangePanel({
  slug,
  query,
  pages,
}: {
  slug: string;
  query: FollowQuery;
  pages: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-10 text-center">
      <h3 className="text-[15px] tracking-tight">Page out of range</h3>
      <p className="mt-3 max-w-[520px] mx-auto text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
        This view has {pages} {pages === 1 ? "page" : "pages"}.{" "}
        <Link
          href={followHref(slug, { ...query, page: 1 }) as never}
          className="text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Go to the first page →
        </Link>
      </p>
    </div>
  );
}

function NoMatchesPanel({ filtered, slug }: { filtered: boolean; slug: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-10 text-center">
      <h3 className="text-[15px] tracking-tight">
        {filtered ? "No matches for these filters" : "No matches above threshold"}
      </h3>
      <p className="mt-3 max-w-[520px] mx-auto text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
        {filtered ? (
          <>
            No stored matches meet the selected department, province, fiscal-year or
            evidence-strength filters.{" "}
            <Link
              href={`/follow/${slug}` as never}
              className="text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              Clear the filters →
            </Link>
          </>
        ) : (
          <>
            The detector ran successfully and produced no records meeting the signal threshold for
            this snapshot. The dataset shows what is in the published record and nothing else.
          </>
        )}
      </p>
    </div>
  );
}

function DetectorErrorPanel({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-accent-fail)]/30 bg-[var(--color-bg-elev-1)] p-8">
      <h3 className="text-[15px] tracking-tight text-[var(--color-accent-fail)]">
        Detector error
      </h3>
      <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">{error}</p>
    </div>
  );
}

type PatternForLegend = NonNullable<ReturnType<typeof getPattern>>;

function SeverityLegend({ pattern }: { pattern: PatternForLegend }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
      <h3 className="text-[15px] tracking-tight">What &ldquo;flagged&rdquo; means here</h3>
      <p className="mt-2 max-w-[800px] text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
        Glassbox surfaces correlations and observations, not findings of misconduct. Severity is
        a calibrated read on how strongly the dataset matches the pattern definition — a starting
        point for review, not a verdict.
      </p>
      <ul className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <SeverityRow
          color="var(--color-fg-muted)"
          label="Observation"
          body="The match meets the pattern threshold but the signal is the lower band. Normal review queue."
        />
        <SeverityRow
          color="var(--color-accent-warn)"
          label="Attention"
          body="The match exceeds the routine threshold. Worth a closer look — pull the source rows, walk the citation."
        />
        <SeverityRow
          color="var(--color-accent-fail)"
          label="Flag"
          body="The match is in the highest band of the calibrated scale. Recommend: prioritise for active review."
        />
      </ul>
      <p className="mt-4 max-w-[800px] font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
        Severity is computed from the detection signal · {pattern.signal}
      </p>
    </section>
  );
}

function SeverityRow({
  color,
  label,
  body,
}: {
  color: string;
  label: string;
  body: string;
}) {
  return (
    <li className="rounded-md border border-[var(--color-border)] p-4">
      <div
        className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.1em]"
        style={{ color }}
      >
        ● {label}
      </div>
      <p className="mt-2 text-[13px] text-[var(--color-fg-muted)] leading-[1.5]">{body}</p>
    </li>
  );
}

function RecommendedActions({ pattern }: { pattern: PatternForLegend }) {
  const recs = recommendationsFor(pattern.id);
  if (recs.length === 0) return null;
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6">
      <h3 className="text-[15px] tracking-tight">Recommended next steps</h3>
      <p className="mt-2 max-w-[800px] text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
        Once a match is identified, the dataset suggests these review actions. Glassbox does not
        prescribe outcomes — these are calibrated options for funders, auditors, and program
        officers, framed as correlations to investigate.
      </p>
      <ol className="mt-5 space-y-3">
        {recs.map((r, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-md border border-[var(--color-border)] p-4"
          >
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-accent)] shrink-0 w-8">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div className="text-[14px] tracking-tight text-[var(--color-fg)]">
                {r.title}
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)] leading-[1.5]">
                {r.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] leading-relaxed">
        These are calibrated suggestions, not directives. The dataset shows the pattern; the
        funder decides the response.
      </p>
    </section>
  );
}

interface Recommendation {
  title: string;
  body: string;
}

/**
 * Per-pattern recommended-action sets. Calibrated language; framed as
 * options for the funder / auditor, never as causal claims or directives.
 *
 * Roadmap: as the recommendations layer matures (see memory entry
 * "Glassbox recommendations roadmap"), these move into a dedicated
 * /recommendations route + per-match action queues.
 */
function recommendationsFor(patternId: string): Recommendation[] {
  switch (patternId) {
    case "funding-loops":
      return [
        {
          title: "Pull the loop participants and their T3010 filings.",
          body:
            "For each entity in the cycle, examine reciprocal gifts, board overlap, and program-vs-overhead ratios. The cycle may reflect denominational hierarchy or federated structure (normal) or reciprocal-revenue inflation (review-worthy).",
        },
        {
          title: "Verify against published structural exclusions.",
          body:
            "Glassbox is not yet hard-coded with denominational hierarchy or federated-charity exclusion lists. Before flagging externally, confirm the loop is not an explainable structural pattern.",
        },
        {
          title: "Cross-reference the cycle members against federal grant flows.",
          body:
            "If the same entities also receive federal grants for similar program purposes, the loop becomes a duplicative-funding signal as well — see /follow/duplicative-funding once that detector ships.",
        },
        {
          title: "Document the review and add to the monitoring list.",
          body:
            "If the loop persists across review cycles, escalate to the relevant audit body. If it resolves (entity exits, program ends, structure clarified), close with reasoning recorded.",
        },
      ];
    case "sole-source-creep":
      return [
        {
          title: "Confirm whether the original procurement was competitive.",
          body:
            "Pull the amendment 0 record. If procurement_method indicates competitive, the growth ratio is the signal. If it was sole-source from the start, the pattern is different (and may be normal).",
        },
        {
          title: "Compare the amendment growth to peer agreements.",
          body:
            "Within the same department + program, what is the median growth ratio? Glassbox can produce that distribution. If this match sits in the top decile of growth, it warrants extra scrutiny.",
        },
        {
          title: "Walk the amendment chain.",
          body:
            "Each amendment row is a published decision. Read the descriptions for purpose drift (also flagged separately as amendment-purpose-drift). Sustained scope expansion across multiple amendments without re-procurement is the review-worthy signal.",
        },
        {
          title: "Evaluate whether re-procurement is overdue.",
          body:
            "Departments with policies on amendment caps (e.g. 2× original within 5 years) can use this match to surface agreements that crossed the threshold and were not refreshed.",
        },
      ];
    case "zombie-recipients":
      return [
        {
          title: "Verify operating status against the corporate registry.",
          body:
            "Cross-reference the recipient legal name with the relevant federal/provincial corporate registry. An active corporate status with no recent grant activity may indicate program completion (normal); a dissolved or in-default status with prior public funding warrants review.",
        },
        {
          title: "Check CRA T3010 last-filed date for charity recipients.",
          body:
            "If the recipient is a registered charity (CRA-registered), pull the most recent T3010 filing date. A gap exceeding 18 months is a regulatory issue independent of the federal-funding silence.",
        },
        {
          title: "Audit deliverable closeout for the most recent agreement.",
          body:
            "Did the funded program complete? Was the final report submitted? Were funds returned, if applicable? Silence in the corpus is not evidence of incompletion, but it is the signal to verify.",
        },
        {
          title: "Decide on monitoring or close.",
          body:
            "Some zombies are just program endings; others are entity disappearances after public money flowed. Close the match with reasoning, or move to active monitoring if outcomes are unclear.",
        },
      ];
    case "ghost-capacity":
      return [
        {
          title: "Confirm the recipient legal identity.",
          body:
            "An entity receiving substantial federal funds without a recorded business number is identifiable only by name string. Verify identity by mapping to corporate / charity registries and adding the BN to the funder's master record.",
        },
        {
          title: "Check whether the entity has the operating capacity claimed.",
          body:
            "TRACE's original definition of ghost capacity covers entities with no employees, no addresses, and revenue dominated by government transfers. For these matches, verify capacity (audited financials, employee count, physical presence) before further awards.",
        },
        {
          title: "Audit the program-deliverable trail.",
          body:
            "What did the entity actually produce for the funding? Pull deliverable reports, site visits, third-party verification. Ghost-capacity is a capacity question, not a fraud claim.",
        },
        {
          title: "Update the funder's data-quality controls.",
          body:
            "Many matches here are data-entry omissions (BN simply not recorded) rather than substantive ghost capacity. Use this list to clean up master records and tighten future intake.",
        },
      ];
    case "vendor-concentration":
      return [
        {
          title: "Decompose the HHI into volume vs. unit-price drivers.",
          body:
            "Concentration can reflect a few large contracts (volume) or many small ones (incumbency). Each implies different responses — the former may be one-off necessity, the latter suggests competitive design issues.",
        },
        {
          title: "Compare the department's HHI against peer departments.",
          body:
            "Some functions are inherently concentrated (specialty equipment, niche expertise). Compare with peer departments delivering similar mandates to identify outliers.",
        },
        {
          title: "Evaluate whether competitive procurement design needs review.",
          body:
            "If concentration persists across multiple FYs, the procurement strategy itself may merit redesign — open tenders, longer notice periods, or explicit competition mandates.",
        },
        {
          title: "Maintain a watchlist of departments above the 2500 HHI threshold.",
          body:
            "Annual re-scoring lets the funder track whether concentration is stable, increasing, or decreasing — and whether interventions are working.",
        },
      ];
    case "amendment-purpose-drift":
      return [
        {
          title: "Read the original and current descriptions side-by-side.",
          body:
            "Low keyword overlap is a signal, not a verdict. The descriptions may have been rewritten using different vocabulary for the same scope. Read them in full before drawing conclusions.",
        },
        {
          title: "Determine whether the scope changed materially.",
          body:
            "If scope changed, re-procurement may have been required under the funder's procurement rules. Flag for legal/procurement review.",
        },
        {
          title: "Check whether the value also grew.",
          body:
            "Drift + growth is a stronger signal than drift alone. Cross-reference with the sole-source-creep pattern.",
        },
      ];
    default:
      return [];
  }
}

function PendingPanel({ pattern }: { pattern: ReturnType<typeof getPattern> }) {
  if (!pattern) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-8">
      {pattern.status === "beta" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector in beta</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            Detection logic is partially implemented. Results may be incomplete. The registry
            entry above describes what the detector is searching for; full match output ships in
            the next deploy.
          </p>
        </div>
      )}
      {pattern.status === "coming" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector pending</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            The pattern is defined and its detection signal is documented. The detector itself is
            not yet running — typically because the underlying source data has not yet been
            ingested or because the detection logic requires schema work.
          </p>
        </div>
      )}
      {pattern.status === "live" && (
        <div>
          <h3 className="text-[15px] tracking-tight">Detector wiring pending</h3>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)] leading-[1.55] max-w-[720px]">
            The pattern is defined live; the detector runtime registration ships in the next
            deploy. API endpoint:{" "}
            <code className="font-[var(--font-mono)] text-[12px] mx-1 px-1.5 py-0.5 bg-[var(--color-bg-elev-2)] rounded">
              /api/patterns/{pattern.id}/matches
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
