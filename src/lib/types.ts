/**
 * Canonical types for the Agency 2026 build.
 * Mirrors the JSON schema in .claude/skills/pythagorithm-proof-token-skill.md.
 */

export type RiskLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type DatasetSource = "cra" | "fed" | "ab" | "general";

export interface EntitySubject {
  entityId: string;
  canonicalName: string;
  bnRoot?: string | null;
  datasetCoverage: DatasetSource[];
}

export type FindingType =
  | "loop_participation"
  | "amendment_creep"
  | "outcome_gap"
  | "concentration_risk"
  | "director_overlap"
  | "adverse_media_match"
  | "provincial_misalignment"
  | "postal_aggregate"
  | "custom";

export interface EvidenceRow {
  source: string;
  rowId: string | number;
  field?: string;
  value: string | number | null;
  asOf?: string;
}

export interface ProofToken {
  proofId: string;
  version: "1.0";
  issuedAt: string;
  issuedBy: string;

  finding: {
    type: FindingType;
    summary: string;
    subject: EntitySubject;
    score: number;
    scoreScale: "0-30" | "0-35" | "category" | "percentile" | "dollars";
    scoreLabel: RiskLabel | string;
  };

  evidence: EvidenceRow[];

  tiers: {
    input: {
      passed: boolean;
      tier: 1;
      filtersApplied: string[];
      knownDataIssuesRespected: string[];
      rejected: string[];
    };
    contextual: {
      passed: boolean;
      tier: 2;
      model: string;
      promptHash: string;
      promptVersion: string;
      temperature: number;
      tokensIn: number;
      tokensOut: number;
    };
    output: {
      passed: boolean;
      tier: 3;
      calibrationCheck: "passed" | "failed";
      citationCount: number;
      quoteWordCountMax: number;
      uniqueSourcesQuoted: number;
      languageViolations: string[];
    };
    audit: {
      passed: boolean;
      tier: 4;
      tokenHash: string;
      previousTokenHash: string | null;
      humanReviewed: boolean;
      humanReviewer: string | null;
      operatorAgent: string;
      logRef: string;
    };
  };

  disclaimers: string[];
  rerunUrl: string;
}

export interface FindingCard {
  proofToken: ProofToken;
  primaryJurisdiction: "federal" | "alberta" | "cra" | "cross";
  lastUpdated: string;
  indicatorCount: number;
}

export interface BriefSentence {
  text: string;
  citations: string[];
}

export interface BriefSection {
  sectionHeading: string;
  sentences: BriefSentence[];
  rationale?: string;
}

export interface BriefSource {
  id: string;
  kind: "ag_report" | "drr" | "hansard" | "news" | "contract" | "self_report";
  title: string;
  url: string;
  year?: number;
  retrievalDate: string;
  authorityTier: 1 | 2 | 3 | 4;
}

export interface OutcomeBrief {
  briefId: string;
  briefType: "outcome" | "counterfactual";
  subject: EntitySubject;
  identity: {
    canonicalName: string;
    bnRoot: string | null;
    addresses: string[];
    datasetCoverage: DatasetSource[];
  };
  governmentRecords: {
    totalAgreementValue: number;
    amendmentCount: number;
    dateRangeStart: string;
    dateRangeEnd: string;
    awardingDepartments: string[];
    programCodes: string[];
    province: string;
  };
  publicSources: BriefSection[];
  unverifiable: { claim: string; rationale: string }[];
  comparableGrants?: {
    grantId: string;
    description: string;
    amount: number;
    departmentCode: string;
    fiscalYear: number;
    similarityTier: 1 | 2 | 3;
  }[];
  pullQuote?: { text: string; attribution: string; sourceId: string };
  sources: BriefSource[];
  proofToken: ProofToken;
}

/** GC Algorithmic Impact Assessment register row (gc_aia_register). */
export interface AIAEntry {
  aiaId: string;
  systemName: string;
  department: string;
  publishedDate: string | null;
  impactLevel: 1 | 2 | 3 | 4;
  riskScore: number;
  mitigationScore: number;
  description: string;
  sourceUrl: string;
  sourceJsonUrl: string | null;
  retrievedAt: string;
}

/** Citation registry row (citation_registry). */
export interface Citation {
  citationId: string;
  sourceType: "ag_report" | "drr" | "hansard" | "news" | "contract" | "self_report";
  sourceUrl: string;
  sourceTitle: string;
  sourceDate: string | null;
  excerpt: string;
  isDirectQuote: boolean;
  pageNumber: number | null;
  entitiesMentioned: string[];
  retrievedAt: string;
  authorityTier: 1 | 2 | 3 | 4;
}
