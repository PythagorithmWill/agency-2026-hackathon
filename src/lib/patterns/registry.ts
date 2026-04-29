/**
 * Pattern registry — the canonical list of named patterns Glassbox surfaces.
 * Six are derived from Alberta TRACE methodology (TRACE attribution required
 * on every UI surface). Six are Glassbox-native.
 *
 * Status:
 *   live   — detector implemented and returning real matches
 *   beta   — detector partial; results may be incomplete
 *   coming — schema defined, detector not yet running
 */

export type PatternAttribution = "TRACE" | "GLASSBOX" | "BOTH";
export type PatternStatus = "live" | "beta" | "coming";

export interface PatternDef {
  id: string; // url slug
  name: string;
  definition: string; // calibrated, single sentence
  signal: string; // technical detection signal (mono caption)
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
    definition:
      "The dataset shows entities that received large public funding then ceased operations within 12 months.",
    signal:
      "Entity death within 12 months of last grant + funding > 70% of total revenue per CRA filing",
    attribution: "TRACE",
    status: "beta",
    order: 1,
  },
  {
    id: "ghost-capacity",
    name: "Ghost Capacity",
    definition:
      "The dataset shows entities persisting with no employees, no physical presence, and revenue almost entirely from government transfers.",
    signal:
      "0 employees + 0 addresses + ≥ 90% revenue from government + filed 3+ consecutive years",
    attribution: "TRACE",
    status: "beta",
    order: 2,
  },
  {
    id: "funding-loops",
    name: "Funding Loops",
    definition:
      "The dataset shows circular money flows between charities — reciprocal pairs, triangular cycles, and longer chains.",
    signal:
      "cra.loop_universe score ≥ 12 (TRACE attention threshold). Categorised as reciprocal / triangular / chain.",
    attribution: "TRACE",
    status: "live",
    order: 3,
  },
  {
    id: "sole-source-creep",
    name: "Sole-Source Amendment Creep",
    definition:
      "The dataset shows contracts that grew at least threefold through amendments after a smaller initial competitive procurement.",
    signal:
      "F-3 max-amendment CTE · final/original ≥ 3.0 · amendment 0 procurement_method = competitive",
    attribution: "TRACE",
    status: "beta",
    order: 4,
  },
  {
    id: "threshold-splitting",
    name: "Threshold Splitting",
    definition:
      "The dataset shows recipients with multiple contracts from the same department clustered just below the competitive procurement threshold.",
    signal:
      "Same recipient + same department + same FY · 3+ agreements with $75K ≤ value ≤ $100K",
    attribution: "TRACE",
    status: "beta",
    order: 5,
  },
  {
    id: "indefinite-sole-source",
    name: "Indefinite Sole-Source",
    definition:
      "The dataset shows vendors that won an initial competitive procurement and subsequently received ongoing sole-source extensions exceeding the original competition value.",
    signal:
      "First agreement competitive · 3+ subsequent sole-source · post-competition total > original",
    attribution: "TRACE",
    status: "coming",
    order: 6,
  },
  {
    id: "concentration-capture",
    name: "Concentration Capture",
    definition:
      "The dataset shows a single recipient receiving more than half of program funding for three or more consecutive fiscal years.",
    signal:
      "max(recipient_share) ≥ 0.5 across ≥ 3 consecutive FYs within a single program",
    attribution: "GLASSBOX",
    status: "beta",
    order: 7,
  },
  {
    id: "amendment-purpose-drift",
    name: "Amendment Purpose Drift",
    definition:
      "The dataset shows agreements whose current-amendment description shares few keywords with the original commitment.",
    signal:
      "Jaccard token similarity (initial.description, current.description) < 0.3 with ≥ 3 amendments",
    attribution: "GLASSBOX",
    status: "live",
    order: 8,
  },
  {
    id: "end-of-year-clustering",
    name: "End-of-Year Clustering",
    definition:
      "The dataset shows agreements clustering in the final fiscal quarter beyond the statistical baseline.",
    signal:
      "Q4 (Jan–Mar) share > μ + 2σ across ≥ 3 fiscal years for a single program or department",
    attribution: "GLASSBOX",
    status: "coming",
    order: 9,
  },
  {
    id: "cross-jurisdictional",
    name: "Cross-Jurisdictional Same-Recipient",
    definition:
      "The dataset shows recipients receiving similar agreements from federal and Alberta provincial sources within the same fiscal year.",
    signal:
      "Same business_number (or fuzzy-matched name) appearing in fed.grants_contributions and ab.ab_grants within ±90 days",
    attribution: "GLASSBOX",
    status: "coming",
    order: 10,
  },
  {
    id: "lobbying-grant-correlation",
    name: "Lobbying-Grant Correlation",
    definition:
      "The dataset shows lobbying activity that preceded grant awards by less than N days, repeatedly, for the same registrant.",
    signal:
      "Lobbyist registration < 90 days before grant award; ≥ 3 occurrences",
    attribution: "GLASSBOX",
    status: "coming",
    order: 11,
  },
  {
    id: "donation-grant-correlation",
    name: "Donation-Grant Correlation",
    definition:
      "The dataset shows political donations that preceded grant awards to associated entities. Correlation only — Glassbox makes no causal claim.",
    signal:
      "Elections Canada donation by named associate < 365 days before grant award; ≥ 2 occurrences",
    attribution: "GLASSBOX",
    status: "coming",
    order: 12,
  },
];

export function getPattern(id: string): PatternDef | null {
  return PATTERNS.find((p) => p.id === id) ?? null;
}

export function tracePatterns(): PatternDef[] {
  return PATTERNS.filter((p) => p.attribution === "TRACE" || p.attribution === "BOTH");
}

export function glassboxPatterns(): PatternDef[] {
  return PATTERNS.filter((p) => p.attribution === "GLASSBOX");
}
