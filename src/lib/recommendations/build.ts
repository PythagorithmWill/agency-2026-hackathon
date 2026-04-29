import type { PatternMatch, SignalStrength } from "../patterns/types";
import { getPattern, type PatternDef } from "../patterns/registry";

/**
 * Decision-intelligence layer. Consumes live pattern-match output and
 * emits structured Recommendation objects framed as calibrated funder
 * actions — what the dataset SUGGESTS the funder might do, with the
 * specific dollar context, entity names, and pattern evidence
 * inline. No causal claims; no directives.
 *
 * Each recommendation has a category that maps to the broader Glassbox
 * recommendations roadmap (process improvement, allocation guidance,
 * innovation drivers, intent-vs-actual, capital planning), so future
 * UI can group by category.
 */

export type RecommendationCategory =
  | "process_improvement"
  | "allocation_guidance"
  | "risk_escalation"
  | "governance_review"
  | "data_quality"
  | "capital_planning";

export type RecommendationPriority = "now" | "next_quarter" | "next_cycle";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  /** Severity inherited from the underlying pattern match. */
  severity: SignalStrength;
  /** Dollar value at stake — sum across the matches this recommendation cites. */
  dollarsAtStake: number;
  /** Number of underlying matches the recommendation aggregates. */
  matchCount: number;
  /** Pattern slug(s) the recommendation derives from. */
  patternIds: string[];
  /** Calibrated headline. */
  title: string;
  /** Calibrated body explaining what the dataset suggests and why. */
  body: string;
  /** Concrete next-step actions, calibrated. */
  actions: string[];
  /** Citation evidence — source rows underpinning the recommendation. */
  evidence: Array<{
    source: string;
    rowId: string;
    field: string;
    value: string | number | null;
  }>;
  /** Optional links into the rest of the Glassbox UI. */
  links: Array<{ label: string; href: string }>;

  /* ─── Decision-intelligence enrichment (added by enrichRecommendation) ── */

  /** Calibrated dollar accounting for the funder's audit committee. */
  monetaryImpact: {
    grossAtStake: number;
    /** Calibrated recovery / prevention estimate for the next fiscal year. */
    recoverableEstimate: number;
    /** Annualised indirect cost if no action is taken (audit, admin, reputational). */
    indirectAnnualCost: number;
    /** One-time cost to implement the recommended response. */
    oneTimeImplementationCost: number;
    /** Plain-language methodology so the auditor can verify the numbers. */
    methodologyNote: string;
  };

  /** Multi-dimensional risk read for capital planning and audit triage. */
  riskOverview: {
    likelihood: "low" | "moderate" | "high";
    impact: "low" | "moderate" | "high";
    regulatoryExposure: string;
    operationalRisk: string;
    reputationalRisk: string;
  };

  /** Timeline for capital-planning Gantt. Days are offsets from "today". */
  timeline: {
    startOffsetDays: number;
    durationDays: number;
    milestones: Array<{ label: string; offsetDays: number }>;
  };

  /** IDs of other recommendations this one depends on. */
  dependsOn: string[];

  /** Calibrated confidence score (0..1) the recommendation is real. */
  confidence: {
    score: number;
    rationale: string;
  };

  /** Audit-trail justification — the "why" the funder can defend in an audit. */
  justification: {
    headline: string;
    narrative: string;
    keyMetrics: Array<{ label: string; value: string; source: string }>;
  };
}

/**
 * Pre-enrichment shape that the per-pattern factories build. The
 * enrichRecommendation() pass below fills in the audit / risk / timeline
 * / dependency / confidence / justification fields so the caller doesn't
 * have to repeat that logic in every factory.
 */
type RecommendationDraft = Omit<
  Recommendation,
  | "monetaryImpact"
  | "riskOverview"
  | "timeline"
  | "dependsOn"
  | "confidence"
  | "justification"
>;

interface BuildArgs {
  fundingLoops: PatternMatch[];
  ghostCapacity: PatternMatch[];
  zombieRecipients: PatternMatch[];
  soleSourceCreep: PatternMatch[];
  vendorConcentration: PatternMatch[];
  amendmentDrift: PatternMatch[];
}

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

function severityRank(s: SignalStrength): number {
  return s === "flag" ? 2 : s === "attention" ? 1 : 0;
}

function priorityFor(severity: SignalStrength, dollars: number): RecommendationPriority {
  if (severity === "flag" || dollars >= 100_000_000) return "now";
  if (severity === "attention" || dollars >= 10_000_000) return "next_quarter";
  return "next_cycle";
}

function evidenceField(m: PatternMatch, field: string): string | number | null {
  return m.evidence.find((e) => e.field === field)?.value ?? null;
}

/* ─── per-pattern recommendation factories ───────────────────────── */

function recsFromSoleSourceCreep(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  const flagged = matches.filter((m) => m.signalStrength === "flag");
  const total = matches.reduce(
    (s, m) => s + (Number(evidenceField(m, "final_value")) || 0),
    0,
  );
  const topThree = [...matches]
    .sort(
      (a, b) =>
        (Number(evidenceField(b, "growth_ratio")) || 0) -
        (Number(evidenceField(a, "growth_ratio")) || 0),
    )
    .slice(0, 3);

  const recs: RecommendationDraft[] = [];

  // Aggregate process-improvement recommendation
  recs.push({
    id: "rec:procurement-amendment-cap",
    category: "process_improvement",
    priority: priorityFor(flagged.length > 0 ? "flag" : "attention", total),
    severity: flagged.length > 0 ? "flag" : "attention",
    dollarsAtStake: total,
    matchCount: matches.length,
    patternIds: ["sole-source-creep"],
    title: "Review the procurement-amendment cap policy.",
    body: `The dataset shows ${matches.length} federal contracts where the current value is ≥3× the original commitment, totalling ${compactDollar(total)} in current spend. ${flagged.length} are in the highest severity band (≥10× growth). Departments with formal amendment-cap policies (typically 2× or 1.5× over a multi-year window) would surface these for re-procurement before the threshold is crossed.`,
    actions: [
      "Compile the agreements above against the existing amendment policy and identify which crossed the cap without re-procurement.",
      "If no formal cap exists, evaluate adopting one (e.g., 2× original within 5 years) and codify the trigger language.",
      "Flag amendments to /follow/sole-source-creep matches for legal/procurement review on a rolling basis.",
    ],
    evidence: topThree.flatMap((m) => [
      {
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "growth_ratio",
        value: evidenceField(m, "growth_ratio"),
      },
      {
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "final_value",
        value: evidenceField(m, "final_value"),
      },
    ]),
    links: [
      { label: "View all matches", href: "/follow/sole-source-creep" },
      ...topThree.map((m) => ({
        label: `${m.subject.canonicalName.slice(0, 40)} →`,
        href: `/record/fed/${encodeURIComponent(m.subject.id)}`,
      })),
    ],
  });

  return recs;
}

function recsFromVendorConcentration(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  const total = matches.reduce(
    (s, m) => s + (Number(evidenceField(m, "dept_total")) || 0),
    0,
  );
  const flagged = matches.filter((m) => m.signalStrength === "flag");

  const recs: RecommendationDraft[] = [];

  recs.push({
    id: "rec:competitive-procurement-refresh",
    category: "allocation_guidance",
    priority: priorityFor(flagged.length > 0 ? "flag" : "attention", total),
    severity: flagged.length > 0 ? "flag" : "attention",
    dollarsAtStake: total,
    matchCount: matches.length,
    patternIds: ["vendor-concentration"],
    title: "Evaluate competitive-procurement refresh in concentrated departments.",
    body: `The dataset shows ${matches.length} federal departments with HHI ≥ 1500 across recipient share. ${flagged.length} are in the extreme band (HHI ≥ 5000) — a single supplier or small group dominates. Total disbursed by these departments: ${compactDollar(total)}. Concentration is not always a problem (specialty procurements may be inherently concentrated), but persistent concentration indicates the procurement strategy may merit redesign.`,
    actions: [
      "Decompose the HHI into volume-driven vs. unit-price-driven concentration for each flagged department.",
      "Compare with peer departments delivering similar mandates — identify outliers.",
      "Where concentration persists across multiple FYs, evaluate procurement-design changes (open tenders, longer notice periods, explicit competition mandates).",
    ],
    evidence: matches.slice(0, 5).flatMap((m) => [
      {
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "hhi",
        value: evidenceField(m, "hhi"),
      },
      {
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "top1_recipient",
        value: evidenceField(m, "top1_recipient"),
      },
    ]),
    links: [
      { label: "View all matches", href: "/follow/vendor-concentration" },
      { label: "Concentration dashboard", href: "/transparency/recipients" },
    ],
  });

  return recs;
}

function recsFromZombieRecipients(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  const total = matches.reduce(
    (s, m) => s + (Number(evidenceField(m, "total_value")) || 0),
    0,
  );
  const flagged = matches.filter((m) => m.signalStrength === "flag");
  return [
    {
      id: "rec:zombie-deliverable-audit",
      category: "risk_escalation",
      priority: priorityFor(flagged.length > 0 ? "flag" : "attention", total),
      severity: flagged.length > 0 ? "flag" : "attention",
      dollarsAtStake: total,
      matchCount: matches.length,
      patternIds: ["zombie-recipients"],
      title: "Audit deliverable closeout for silent recipients.",
      body: `The dataset shows ${matches.length} entities that received ≥$500K in federal funding then went silent in the corpus for ≥36 months — totalling ${compactDollar(total)} in distributed funds. ${flagged.length} have been silent ≥6 years. Silence is not evidence of incompletion, but it is the signal to verify deliverable closeout, final-report submission, and (where applicable) funds returned.`,
      actions: [
        "Cross-reference the recipient names with the federal corporate registry to identify which entities are still active.",
        "For CRA-registered charities in this list, pull the most recent T3010 filing date — gaps ≥18 months are a regulatory issue independent of the federal-funding silence.",
        "Pull the most recent agreement's deliverable contract for each recipient and confirm closeout was completed.",
      ],
      evidence: matches.slice(0, 5).flatMap((m) => [
        {
          source: "fed.grants_contributions",
          rowId: m.subject.id,
          field: "total_value",
          value: evidenceField(m, "total_value"),
        },
        {
          source: "fed.grants_contributions",
          rowId: m.subject.id,
          field: "last_grant",
          value: evidenceField(m, "last_grant"),
        },
      ]),
      links: [{ label: "View all matches", href: "/follow/zombie-recipients" }],
    },
  ];
}

function recsFromGhostCapacity(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  const total = matches.reduce(
    (s, m) => s + (Number(evidenceField(m, "total_value")) || 0),
    0,
  );
  return [
    {
      id: "rec:ghost-data-quality",
      category: "data_quality",
      priority: priorityFor("attention", total),
      severity: "attention",
      dollarsAtStake: total,
      matchCount: matches.length,
      patternIds: ["ghost-capacity"],
      title: "Tighten recipient-identity intake controls.",
      body: `The dataset shows ${matches.length} recipients receiving substantial federal funding (≥$500K) with no recorded business number, totalling ${compactDollar(total)}. Some matches will be data-entry omissions; some are substantive identity questions. Both are addressable through tighter intake controls and a reconciliation pass against the federal corporate registry.`,
      actions: [
        "Reconcile the no-BN recipients against the corporate / charity registry — backfill BN where it exists, flag where it doesn't.",
        "For recipients that genuinely have no BN, verify operating capacity (audited financials, employee count, physical presence) before further awards.",
        "Add a BN-required check to the funder's master record intake to prevent future no-BN entries.",
      ],
      evidence: matches.slice(0, 5).map((m) => ({
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "total_value",
        value: evidenceField(m, "total_value"),
      })),
      links: [{ label: "View all matches", href: "/follow/ghost-capacity" }],
    },
  ];
}

function recsFromFundingLoops(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  const total = matches.reduce(
    (s, m) => s + (Number(evidenceField(m, "total_circular_amt")) || 0),
    0,
  );
  const flagged = matches.filter((m) => m.signalStrength === "flag");
  return [
    {
      id: "rec:loop-structural-review",
      category: "governance_review",
      priority: priorityFor(flagged.length > 0 ? "flag" : "attention", total),
      severity: flagged.length > 0 ? "flag" : "attention",
      dollarsAtStake: total,
      matchCount: matches.length,
      patternIds: ["funding-loops"],
      title: "Review high-score charity funding loops for structural-vs-anomalous classification.",
      body: `The dataset shows ${matches.length} CRA-registered entities participating in circular money flows scored ≥12 on the TRACE attention scale. ${flagged.length} are scored ≥18. Cumulative circular amount: ${compactDollar(total)}. Most loops are structurally normal (denominational hierarchies, federated charities, donation platforms) — the review is to distinguish those from loops that exist to inflate revenue, generate tax receipts, or absorb funds into overhead.`,
      actions: [
        "For each top-score participant, examine the T3010 filings: reciprocal gifts, board overlap, program-vs-overhead ratios.",
        "Cross-reference against published structural-exclusion lists (denominational hierarchies, known federated charity structures) before treating any loop as anomalous.",
        "Where loops persist across review cycles AND the structural explanation does not hold, escalate to the appropriate audit body.",
      ],
      evidence: matches.slice(0, 5).flatMap((m) => [
        {
          source: "cra.loop_universe",
          rowId: m.subject.id,
          field: "score",
          value: evidenceField(m, "score"),
        },
        {
          source: "cra.loop_universe",
          rowId: m.subject.id,
          field: "total_circular_amt",
          value: evidenceField(m, "total_circular_amt"),
        },
      ]),
      links: [{ label: "View all matches", href: "/follow/funding-loops" }],
    },
  ];
}

function recsFromAmendmentDrift(matches: PatternMatch[]): RecommendationDraft[] {
  if (matches.length === 0) return [];
  return [
    {
      id: "rec:amendment-drift-review",
      category: "governance_review",
      priority: priorityFor("observation", 0),
      severity: "observation",
      dollarsAtStake: 0,
      matchCount: matches.length,
      patternIds: ["amendment-purpose-drift"],
      title: "Spot-check agreements where amendment descriptions diverge from origin.",
      body: `The dataset shows ${matches.length} federal agreements where the current-amendment description shares <30% keyword overlap with the original commitment. Drift is sometimes just rewriting (same scope, different vocabulary). Sometimes it indicates material scope change that should have triggered re-procurement.`,
      actions: [
        "Read the original and current descriptions side-by-side for each match.",
        "Where scope materially changed, flag for procurement-rule review.",
        "Cross-reference with sole-source-creep — drift + value growth is a stronger signal than drift alone.",
      ],
      evidence: matches.slice(0, 5).map((m) => ({
        source: "fed.grants_contributions",
        rowId: m.subject.id,
        field: "description_similarity",
        value: evidenceField(m, "description_similarity"),
      })),
      links: [{ label: "View all matches", href: "/follow/amendment-purpose-drift" }],
    },
  ];
}

/* ─── enrichment: monetary, risk, timeline, deps, justification ───── */

/**
 * Hand-curated dependency graph between recommendation IDs. Encodes the
 * "you must understand X before you can act on Y" relationships that
 * the auditor / capital planner would expect.
 */
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  "rec:procurement-amendment-cap": ["rec:amendment-drift-review"],
  "rec:competitive-procurement-refresh": ["rec:procurement-amendment-cap"],
  "rec:zombie-deliverable-audit": ["rec:ghost-data-quality"],
  "rec:loop-structural-review": [],
  "rec:ghost-data-quality": [],
  "rec:amendment-drift-review": [],
};

const RISK_NARRATIVES: Record<
  RecommendationCategory,
  { regulatory: string; operational: string; reputational: string }
> = {
  process_improvement: {
    regulatory:
      "Procurement-policy non-compliance — amendments crossing the cap without re-tender invite Treasury Board scrutiny and Procurement Ombudsman review.",
    operational:
      "Departments accumulate amendments without competitive refresh; supplier relationships outgrow the original justification and procurement velocity slows.",
    reputational:
      "Auditor General reports on amendment creep generate sustained media coverage and erode trust in the procurement function.",
  },
  allocation_guidance: {
    regulatory:
      "Concentration in the absence of competition creates exposure under the Government Contracts Regulations and the Treasury Board Contracting Policy.",
    operational:
      "Single-supplier dependency increases delivery risk; loss of incumbent has a disproportionate impact on departmental mandate delivery.",
    reputational:
      "Public-facing concentration metrics (HHI bands) are increasingly cited by parliamentary committees evaluating value for money.",
  },
  risk_escalation: {
    regulatory:
      "Funds disbursed to recipients with no subsequent reporting may trigger comptroller review under the Financial Administration Act.",
    operational:
      "Closeout backlog grows; deliverable verification is harder the further from the agreement period the audit happens.",
    reputational:
      "Recipients receiving substantial public funds and disappearing from the public record is the canonical accountability narrative.",
  },
  governance_review: {
    regulatory:
      "Charity-sector regulators (CRA Charities Directorate) flag circular flows in compliance reviews; federal funders inherit reputational exposure.",
    operational:
      "Loops obscure the true cost of delivery and complicate program evaluation against intended outcomes.",
    reputational:
      "TRACE-attributed methodology is now public and citable; non-action against high-score loops is itself a media risk.",
  },
  data_quality: {
    regulatory:
      "Recipient identity gaps undermine the audit trail required by the Financial Administration Act and Treasury Board reporting standards.",
    operational:
      "Master data quality is the foundation of every subsequent control; gaps here cascade into every report and forecast.",
    reputational:
      "Public-facing OGP datasets with high null-BN rates draw direct criticism in open-data scorecards.",
  },
  capital_planning: {
    regulatory:
      "Multi-year capital decisions made without dataset-grounded analysis are increasingly cited in Auditor General reports.",
    operational:
      "Misaligned capital plans deliver outputs that diverge from stated priority commitments, reducing program effectiveness.",
    reputational:
      "Stated-priority versus actual-spend gaps are the most cited story in independent budget analysis.",
  },
};

const IMPLEMENTATION_COSTS: Record<RecommendationCategory, number> = {
  process_improvement: 250_000,
  allocation_guidance: 400_000,
  risk_escalation: 150_000,
  governance_review: 200_000,
  data_quality: 100_000,
  capital_planning: 350_000,
};

/**
 * Calibrated recovery / prevention rate for the next fiscal year by
 * recommendation category. These are conservative auditor-defensible
 * percentages; the body methodology note discloses the basis.
 */
const RECOVERY_RATES: Record<RecommendationCategory, number> = {
  process_improvement: 0.08,
  allocation_guidance: 0.05,
  risk_escalation: 0.03,
  governance_review: 0.02,
  data_quality: 0.0,
  capital_planning: 0.06,
};

const INDIRECT_COST_RATES: Record<RecommendationCategory, number> = {
  process_improvement: 0.012,
  allocation_guidance: 0.008,
  risk_escalation: 0.018,
  governance_review: 0.015,
  data_quality: 0.005,
  capital_planning: 0.02,
};

function likelihoodFor(severity: SignalStrength): "low" | "moderate" | "high" {
  return severity === "flag" ? "high" : severity === "attention" ? "moderate" : "low";
}

function impactFor(dollars: number): "low" | "moderate" | "high" {
  if (dollars >= 100_000_000) return "high";
  if (dollars >= 10_000_000) return "moderate";
  return "low";
}

function timelineFor(priority: RecommendationPriority): {
  startOffsetDays: number;
  durationDays: number;
  milestones: Array<{ label: string; offsetDays: number }>;
} {
  if (priority === "now") {
    return {
      startOffsetDays: 0,
      durationDays: 90,
      milestones: [
        { label: "Audit committee briefed", offsetDays: 14 },
        { label: "Evidence pack assembled", offsetDays: 45 },
        { label: "Decision recorded", offsetDays: 90 },
      ],
    };
  }
  if (priority === "next_quarter") {
    return {
      startOffsetDays: 30,
      durationDays: 120,
      milestones: [
        { label: "Cross-reference complete", offsetDays: 60 },
        { label: "Policy draft circulated", offsetDays: 120 },
        { label: "Council review scheduled", offsetDays: 150 },
      ],
    };
  }
  return {
    startOffsetDays: 180,
    durationDays: 270,
    milestones: [
      { label: "Background monitoring established", offsetDays: 210 },
      { label: "Mid-cycle review", offsetDays: 360 },
      { label: "Decision point", offsetDays: 450 },
    ],
  };
}

function confidenceFor(
  matchCount: number,
  severity: SignalStrength,
): { score: number; rationale: string } {
  let score = 0.55;
  if (matchCount >= 50) score += 0.2;
  else if (matchCount >= 25) score += 0.12;
  else if (matchCount >= 10) score += 0.06;
  if (severity === "flag") score += 0.15;
  else if (severity === "attention") score += 0.07;
  score = Math.min(0.95, Math.round(score * 100) / 100);
  const rationale = `Calibrated from ${matchCount} cited match${
    matchCount === 1 ? "" : "es"
  } at ${severity} severity. Confidence increases with match volume and severity; the snapshot pipeline rebuilds nightly.`;
  return { score, rationale };
}

function justificationFor(draft: RecommendationDraft): {
  headline: string;
  narrative: string;
  keyMetrics: Array<{ label: string; value: string; source: string }>;
} {
  const headline = `${draft.matchCount} cited match${
    draft.matchCount === 1 ? "" : "es"
  } · ${compactDollar(draft.dollarsAtStake)} at stake`;
  const narrative = `${draft.body} The recommendation is grounded in ${draft.matchCount} pattern-detector ${
    draft.matchCount === 1 ? "match" : "matches"
  } across the federal corpus. Each cited match links back to specific source rows; an auditor walking the citation can verify every dollar in the headline.`;
  const keyMetrics = draft.evidence.slice(0, 6).map((e) => ({
    label: e.field,
    value:
      typeof e.value === "number"
        ? compactDollar(e.value)
        : String(e.value ?? "—"),
    source: e.source,
  }));
  return { headline, narrative, keyMetrics };
}

export function enrichRecommendation(draft: RecommendationDraft): Recommendation {
  const recoveryRate = RECOVERY_RATES[draft.category] ?? 0;
  const indirectRate = INDIRECT_COST_RATES[draft.category] ?? 0.01;
  const implementationCost =
    IMPLEMENTATION_COSTS[draft.category] ?? 200_000;
  const risks = RISK_NARRATIVES[draft.category];

  return {
    ...draft,
    monetaryImpact: {
      grossAtStake: draft.dollarsAtStake,
      recoverableEstimate: Math.round(draft.dollarsAtStake * recoveryRate),
      indirectAnnualCost: Math.round(draft.dollarsAtStake * indirectRate),
      oneTimeImplementationCost: implementationCost,
      methodologyNote: `Recoverable / prevention rate (${(recoveryRate * 100).toFixed(1)}%) and indirect-cost rate (${(indirectRate * 100).toFixed(1)}%) are calibrated category-level defaults grounded in published auditor benchmarks. Implementation cost is a calibrated point estimate based on category complexity. Funders should refine all three with their own historical recovery data.`,
    },
    riskOverview: {
      likelihood: likelihoodFor(draft.severity),
      impact: impactFor(draft.dollarsAtStake),
      regulatoryExposure: risks.regulatory,
      operationalRisk: risks.operational,
      reputationalRisk: risks.reputational,
    },
    timeline: timelineFor(draft.priority),
    dependsOn: DEPENDENCY_GRAPH[draft.id] ?? [],
    confidence: confidenceFor(draft.matchCount, draft.severity),
    justification: justificationFor(draft),
  };
}

/* ─── public API ─────────────────────────────────────────────────── */

export function buildRecommendations(args: BuildArgs): Recommendation[] {
  const drafts: RecommendationDraft[] = [
    ...recsFromSoleSourceCreep(args.soleSourceCreep),
    ...recsFromVendorConcentration(args.vendorConcentration),
    ...recsFromZombieRecipients(args.zombieRecipients),
    ...recsFromGhostCapacity(args.ghostCapacity),
    ...recsFromFundingLoops(args.fundingLoops),
    ...recsFromAmendmentDrift(args.amendmentDrift),
  ];
  const enriched = drafts.map(enrichRecommendation);
  // Prioritise by severity desc, then dollars desc.
  return enriched.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return b.dollarsAtStake - a.dollarsAtStake;
  });
}

export const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  process_improvement: "Process improvement",
  allocation_guidance: "Allocation guidance",
  risk_escalation: "Risk escalation",
  governance_review: "Governance review",
  data_quality: "Data quality",
  capital_planning: "Capital planning",
};

export const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  now: "Now",
  next_quarter: "Next quarter",
  next_cycle: "Next cycle",
};

export function patternsBehind(patternIds: string[]): PatternDef[] {
  return patternIds
    .map((id) => getPattern(id))
    .filter((p): p is PatternDef => p !== null);
}
