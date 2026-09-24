/**
 * Pattern registry — the eight Agency 2026 hackathon challenges, plus
 * Glassbox-native extras. The eight challenges are the demo focus.
 *
 * Status:
 *   live   — detector implemented and returning real matches
 *   beta   — detector partial; results may be incomplete
 *   coming — schema defined, detector not yet running
 *
 * Attribution:
 *   TRACE     — detection methodology derived from Alberta TRACE
 *   GLASSBOX  — Glassbox-native (extends TRACE methodology beyond charities)
 *   BOTH      — both TRACE-derived and Glassbox-extended
 *
 * Methodology v2 (2026-09): thresholds are RELATIVE (percentile within a
 * peer group — program or department) with the documented absolute floor
 * kept as a secondary guard; time windows are ROLLING from the corpus
 * as-of date (MAX(agreement_start_date) ≤ CURRENT_DATE), never fixed
 * dates. Every match carries an evidence strength (strength.ts) and, when
 * applicable, the most relevant false-positive note from the list below.
 */

import { FP } from "./false-positives";

export type PatternAttribution = "TRACE" | "GLASSBOX" | "BOTH";
export type PatternStatus = "live" | "beta" | "coming";

export interface PatternDef {
  id: string; // url slug
  name: string;
  /** The Agency 2026 hackathon challenge number (1–8), or null for extras. */
  challenge: number | null;
  /** One-sentence calibrated definition. */
  definition: string;
  /** Technical detection signal (mono caption). */
  signal: string;
  attribution: PatternAttribution;
  status: PatternStatus;
  /** Display order on /follow */
  order: number;
  /**
   * Known benign explanations for a match — the upstream's own caveat
   * lists (false-positives.ts). strength.ts picks the most applicable one
   * per match as `benignNote`.
   */
  falsePositiveNotes: string[];
}

/** Alias kept for callers that use the longer name. */
export type PatternDefinition = PatternDef;

export const TRACE_ATTRIBUTION_LINE =
  "Pattern definition based on Alberta TRACE program (Targeted Review of Alberta's Contracts and Expenditures), Ministry of Technology and Innovation, Government of Alberta.";

/** Absolute floors and windows in force (also referenced by detectors and tests). */
export const THRESHOLDS = {
  /** Rolling window length for silence / concentration windows. */
  ROLLING_WINDOW_MONTHS: 36,
  /** Peer-group percentile used as the primary (relative) threshold. */
  PERCENTILE: 0.9,
  ZOMBIE_TOTAL_FLOOR: 500_000,
  GHOST_TOTAL_FLOOR: 500_000,
  CREEP_ORIGINAL_FLOOR: 100_000,
  CREEP_RATIO_FLOOR: 3.0,
  VENDOR_PROGRAM_FLOOR: 10_000_000,
  VENDOR_HHI_FLOOR: 1500,
  VENDOR_MIN_RECIPIENTS: 3,
  DUP_FED_FLOOR: 5,
  DUP_AB_FLOOR: 5,
  GOLDEN_CONFIDENCE_FLOOR: 0.7,
  RELATED_FLOOR: 2,
  LOOP_GIFT_FLOOR: 5_000,
  LOOP_MAX_HOPS: 4,
  LOOP_SPAN_MONTHS: 12,
  LOOP_HUB_DEGREE: 50,
  LOOP_SCORE_FLOOR: 0.05,
  LOOP_UNIVERSE_SCORE_FLOOR: 12,
} as const;

export const PATTERNS: PatternDef[] = [
  {
    id: "zombie-recipients",
    name: "Zombie Recipients",
    challenge: 1,
    definition:
      "The dataset shows entities that received substantial federal funding then ceased appearing in the corpus — flagging recipients that went silent after the money flowed.",
    signal:
      "recipient total (original commitments, is_amendment = false) ≥ p90 of recipient totals within the recipient's primary department AND ≥ $500K floor · last agreement_start_date < as-of − 36 months, as-of = MAX(agreement_start_date) ≤ CURRENT_DATE · signal = years silent",
    attribution: "BOTH",
    status: "live",
    order: 1,
    falsePositiveNotes: [FP.ONE_OFF_CAPITAL, FP.PROGRAM_SUNSET, FP.PLACEHOLDER_BN, FP.NAME_ONLY_IDENTITY, FP.PUBLISHER_AGGREGATED],
  },
  {
    id: "ghost-capacity",
    name: "Ghost Capacity",
    challenge: 2,
    definition:
      "The dataset shows entities receiving substantial federal funding with no recorded business identity — recipients the federal government cannot independently identify.",
    signal:
      "recipient_business_number IS NULL or a placeholder ('0', all-zeros, '-', 'n/a', 'none') · is_amendment = false · total ≥ p90 of ALL recipient totals within the recipient's primary department AND ≥ $500K floor · publisher batch-report rows excluded · signal = total $",
    attribution: "BOTH",
    status: "live",
    order: 2,
    falsePositiveNotes: [FP.PUBLISHER_AGGREGATED, FP.STATUTORY_TRANSFER, FP.NAME_ONLY_IDENTITY],
  },
  {
    id: "funding-loops",
    name: "Funding Loops",
    challenge: 3,
    definition:
      "The dataset shows circular money flows between charities — reciprocal pairs, triangular cycles, and longer chains. Most loops are structurally normal; the signal is the deviation from norm.",
    signal:
      "app.gift_loops: simple cycles ≤ 4 hops in the ≥ $5K qualified-donee gift graph, hop fiscal periods non-decreasing and the whole loop within 12 months, hubs (degree ≥ 50 or DAF/foundation/federated/diocese names) never interior; edge weight = gift ÷ donor's gifts that year; score = min edge weight × hops penalty (2:1.0, 3:0.8, 4:0.6); aggregated per BN, best loop ≥ 0.05 · fallback: cra.loop_universe score ≥ 12",
    attribution: "TRACE",
    status: "live",
    order: 3,
    falsePositiveNotes: [FP.DAF_PLATFORM, FP.COMMUNITY_FOUNDATION, FP.FEDERATED_CHARITY, FP.DENOMINATIONAL_HIERARCHY, FP.UNIT_ERROR, FP.UNREGISTERED_DONEE],
  },
  {
    id: "sole-source-creep",
    name: "Sole-Source & Amendment Creep",
    challenge: 4,
    definition:
      "The dataset shows contracts that started small and grew at least threefold through amendments — surfacing procurement relationships that may have outgrown their original justification.",
    signal:
      "agreement_value is cumulative (F-3): original = amendment-0 row ≥ $100K · final = highest-amendment row · final/original ≥ 3.0 AND ≥ p90 of growth ratios among amended agreements in the same program · ≥ 1 amendment row · chains keyed by (ref_number, BN|legal name) per F-1 · signal = growth ratio",
    attribution: "BOTH",
    status: "live",
    order: 4,
    falsePositiveNotes: [FP.DUPLICATE_ROWS, FP.NEGATIVE_VALUES, FP.REF_COLLISION, FP.PLACEHOLDER_BN],
  },
  {
    id: "vendor-concentration",
    name: "Vendor Concentration",
    challenge: 5,
    definition:
      "The dataset shows programs where a single supplier or small group receives a disproportionate share of spend — incumbency replacing competition.",
    signal:
      "per (department, program) over the rolling 36 months to the corpus as-of date · program total ≥ $10M · ≥ 3 recipients · HHI = Σ recipient share² × 100² ≥ p90 of program HHIs within the department AND ≥ 1500 floor · bands: ≥5000 extreme, ≥2500 highly, ≥1500 moderately concentrated · signal = HHI",
    attribution: "BOTH",
    status: "live",
    order: 5,
    falsePositiveNotes: [FP.SINGLE_RECIPIENT_PROGRAM, FP.STATUTORY_TRANSFER, FP.NAME_ONLY_IDENTITY],
  },
  {
    id: "related-parties",
    name: "Related Parties & Governance Networks",
    challenge: 6,
    definition:
      "The dataset shows entities the upstream entity-resolution pipeline adjudicated as RELATED to other funded entities — distinct legal registrations that share a name, structure, or governance lineage — where related-party relationships are more likely to materialise.",
    signal:
      "general.entity_merge_candidates.llm_verdict = 'RELATED' (Splink candidate → LLM adjudication) edges joined to general.entity_golden_records on both sides · ≥ 2 distinct RELATED counterparties · confidence ≥ 0.7 · signal = related-counterparty count · severity weights cross-dataset presence and source-record volume",
    attribution: "GLASSBOX",
    status: "live",
    order: 6,
    falsePositiveNotes: [FP.FEDERATED_CHARITY, FP.DENOMINATIONAL_HIERARCHY, FP.COMMUNITY_FOUNDATION, FP.DAF_PLATFORM],
  },
  {
    id: "policy-misalignment",
    name: "Policy Misalignment",
    challenge: 7,
    definition:
      "The dataset shows the gap between named policy priorities (emissions, housing, reconciliation, healthcare) and the actual flow of funds — concrete spend versus stated plan.",
    signal:
      "ILIKE keyword match on prog_purpose_en / prog_name_en, summed over the rolling 5 years to the corpus as-of date, compared to a calibrated stated annual commitment per priority · signal = actual ÷ stated",
    attribution: "GLASSBOX",
    status: "live",
    order: 7,
    falsePositiveNotes: [FP.KEYWORD_PROXY],
  },
  {
    id: "duplicative-funding",
    name: "Duplicative Funding & Gaps",
    challenge: 8,
    definition:
      "The dataset shows recipients receiving funding from both the federal grants & contributions stream and Alberta provincial grants — entities sitting at the intersection of two funder pools where program duplication is a real risk that funders can verify against.",
    signal:
      "general.entity_golden_records with both 'fed' and 'ab' in dataset_sources · ≥ 5 federal and ≥ 5 Alberta source records · combined record count ≥ p90 within the entity's entity_type · confidence ≥ 0.7 · signal = combined record count",
    attribution: "GLASSBOX",
    status: "live",
    order: 8,
    falsePositiveNotes: [FP.LEGITIMATE_DUAL_FUNDING, FP.STATUTORY_TRANSFER, FP.PLACEHOLDER_BN],
  },
  // Glassbox extras (not in the 8 challenges, but shipped detectors)
  {
    id: "amendment-purpose-drift",
    name: "Amendment Purpose Drift",
    challenge: null,
    definition:
      "The dataset shows agreements whose current-amendment description shares few keywords with the original commitment — the contract has drifted from its initial purpose.",
    signal:
      "Jaccard token similarity (initial.description, current.description) < 0.30 with ≥ 3 amendments · chains keyed per F-1 · signal = 1 − similarity",
    attribution: "GLASSBOX",
    status: "live",
    order: 9,
    falsePositiveNotes: [FP.DESCRIPTION_REWRITE, FP.DUPLICATE_ROWS, FP.REF_COLLISION],
  },
];

export function getPattern(id: string): PatternDef | null {
  return PATTERNS.find((p) => p.id === id) ?? null;
}

export function tracePatterns(): PatternDef[] {
  return PATTERNS.filter((p) => p.attribution === "TRACE" || p.attribution === "BOTH");
}

export function challengePatterns(): PatternDef[] {
  return PATTERNS.filter((p) => p.challenge !== null).sort(
    (a, b) => (a.challenge ?? 99) - (b.challenge ?? 99),
  );
}

export function extraPatterns(): PatternDef[] {
  return PATTERNS.filter((p) => p.challenge === null);
}
