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
 */

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
}

export const TRACE_ATTRIBUTION_LINE =
  "Pattern definition based on Alberta TRACE program (Targeted Review of Alberta's Contracts and Expenditures), Ministry of Technology and Innovation, Government of Alberta.";

export const PATTERNS: PatternDef[] = [
  {
    id: "zombie-recipients",
    name: "Zombie Recipients",
    challenge: 1,
    definition:
      "The dataset shows entities that received substantial federal funding then ceased appearing in the corpus — flagging recipients that went silent after the money flowed.",
    signal:
      "total funding ≥ $500K · last agreement_start_date < CURRENT_DATE − 36 months · is_amendment = false",
    attribution: "BOTH",
    status: "live",
    order: 1,
  },
  {
    id: "ghost-capacity",
    name: "Ghost Capacity",
    challenge: 2,
    definition:
      "The dataset shows entities receiving substantial federal funding with no recorded business identity — recipients the federal government cannot independently identify.",
    signal:
      "recipient_business_number IS NULL · is_amendment = false · total funding ≥ $500K. Severity scales by total $ and departmental spread.",
    attribution: "BOTH",
    status: "live",
    order: 2,
  },
  {
    id: "funding-loops",
    name: "Funding Loops",
    challenge: 3,
    definition:
      "The dataset shows circular money flows between charities — reciprocal pairs, triangular cycles, and longer chains. Most loops are structurally normal; the signal is the deviation from norm.",
    signal:
      "cra.loop_universe score ≥ 12 (TRACE attention threshold). Sub-categorised reciprocal · triangular · chain.",
    attribution: "TRACE",
    status: "live",
    order: 3,
  },
  {
    id: "sole-source-creep",
    name: "Sole-Source & Amendment Creep",
    challenge: 4,
    definition:
      "The dataset shows contracts that started small and grew at least threefold through amendments — surfacing procurement relationships that may have outgrown their original justification.",
    signal:
      "original_value ≥ $100K · final/original ≥ 3.0 · ≥ 1 amendment row (is_amendment = true)",
    attribution: "BOTH",
    status: "live",
    order: 4,
  },
  {
    id: "vendor-concentration",
    name: "Vendor Concentration",
    challenge: 5,
    definition:
      "The dataset shows departments where a single supplier or small group receives a disproportionate share of contract spend — incumbency replacing competition.",
    signal:
      "HHI ≥ 1500 (Σ recipient share² × 100²) over departmental spend with ≥ $100M total. Bands: ≥5000 extreme, ≥2500 highly concentrated, ≥1500 moderately concentrated.",
    attribution: "BOTH",
    status: "live",
    order: 5,
  },
  {
    id: "related-parties",
    name: "Related Parties & Governance Networks",
    challenge: 6,
    definition:
      "The dataset shows individuals who sit on multiple boards of entities that fund each other, or principals of companies receiving contracts who also direct charities receiving grants.",
    signal:
      "graph join across CRA t3010 directors × federal recipient_legal_name × Alberta procurement vendor names",
    attribution: "GLASSBOX",
    status: "coming",
    order: 6,
  },
  {
    id: "policy-misalignment",
    name: "Policy Misalignment",
    challenge: 7,
    definition:
      "The dataset shows the gap between named policy priorities (emissions, housing, reconciliation, healthcare) and the actual flow of funds — concrete spend versus stated plan.",
    signal:
      "policy keyword filter on prog_purpose_en × spending_total grouped by FY, vs. published target text",
    attribution: "GLASSBOX",
    status: "coming",
    order: 7,
  },
  {
    id: "duplicative-funding",
    name: "Duplicative Funding & Gaps",
    challenge: 8,
    definition:
      "The dataset shows recipients receiving similar agreements from multiple levels of government simultaneously, and policy areas where every level claims priority but none funds.",
    signal:
      "fuzzy-name matched recipient appearing in fed.grants_contributions and ab.ab_grants within ±90 days for similar prog_purpose; complement: program category in named priority with < threshold spend",
    attribution: "GLASSBOX",
    status: "coming",
    order: 8,
  },
  // Glassbox extras (not in the 8 challenges, but shipped detectors)
  {
    id: "amendment-purpose-drift",
    name: "Amendment Purpose Drift",
    challenge: null,
    definition:
      "The dataset shows agreements whose current-amendment description shares few keywords with the original commitment — the contract has drifted from its initial purpose.",
    signal:
      "Jaccard token similarity (initial.description, current.description) < 0.30 with ≥ 3 amendments",
    attribution: "GLASSBOX",
    status: "live",
    order: 9,
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
