/**
 * Canonical TypeScript types for the Pythagorithm — Suitability product.
 * Mirrors the schemas in:
 *   - .claude/skills/pythagorithm-proof-token-skill.md (ProofToken)
 *   - docs/PRD.md (DraftSubmission, EvaluationResult, ComparableRecord, …)
 */

export type DatasetSource = "fed" | "ab_grants" | "ab_contracts" | "general";

export type Verdict = "PROCEED" | "CONSOLIDATE" | "DECLINE AS DUPLICATIVE";
export type RiskLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | Verdict;

/* ─────────────────────────────────────────────────────────────────────────
   Proof token — the universal output wrapper
   ───────────────────────────────────────────────────────────────────── */

export interface EntitySubject {
  entityId: string;
  canonicalName: string;
  bnRoot?: string | null;
  datasetCoverage: DatasetSource[];
}

export type FindingType =
  | "draft_evaluation"
  | "similarity_match"
  | "suitability_score"
  | "recommendation"
  | "concentration_observation"
  | "loop_participation"
  | "amendment_creep"
  | "outcome_gap"
  | "concentration_risk"
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
    scoreScale: "0-30" | "0-10" | "0-1" | "category" | "percentile" | "dollars";
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
  rerunUrl?: string;
  verifyUrl?: string;
  downloadUrl?: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Draft submission + comparable retrieval
   ───────────────────────────────────────────────────────────────────── */

export interface DraftSubmission {
  workingTitle: string;
  draftText: string;
  awardingDepartment: string;
  anticipatedAmount: number;
  anticipatedFiscalYear: number;
}

export interface ComparableRecord {
  recordId: string;
  sourceDataset: DatasetSource;
  recipientLegalName: string;
  recipientBn: string | null;
  recipientProvince: string | null;
  awardingDept: string;
  programCode: string | null;
  fiscalYear: number;
  agreementValue: number;
  description: string;
  similarity: number; // 0-1
  retrievalReason: "semantic" | "keyword" | "hybrid";
}

export interface AwardeeConcentration {
  topRecipients: {
    name: string;
    bn: string | null;
    totalAwarded: number;
    awardCount: number;
    share: number;
  }[];
  hhi: number;
  observation: string;
  citations: string[];
}

/* ─────────────────────────────────────────────────────────────────────────
   Calibration & suitability
   ───────────────────────────────────────────────────────────────────── */

export type CalibrationFlagType =
  | "CALIBRATION_LEAK"
  | "MISSING_CITATION"
  | "PROOF_INCOMPLETE"
  | "QUOTE_TOO_LONG"
  | "QUOTE_REUSED"
  | "LOW_CONFIDENCE_ENTITY";

export interface CalibrationFlag {
  type: CalibrationFlagType;
  start: number;
  end: number;
  match: string;
  rewrite?: string;
}

export interface SuitabilityScore {
  uniqueness: number;
  duplicationRisk: number;
  recipientConcentration: number;
  languageCalibration: number;
  composite: number;
  verdict: Verdict;
  weights: {
    uniqueness: number;
    duplicationRisk: number;
    recipientConcentration: number;
    languageCalibration: number;
  };
  perComponentExplanation: {
    uniqueness: string;
    duplicationRisk: string;
    recipientConcentration: string;
    languageCalibration: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   The full evaluation result
   ───────────────────────────────────────────────────────────────────── */

export interface EvaluationResult {
  evaluationId: string;
  submission: DraftSubmission;
  comparables: ComparableRecord[];
  awardeeConcentration: AwardeeConcentration;
  calibrationFlags: CalibrationFlag[];
  suitability: SuitabilityScore;
  recommendation: { text: string; tone: "proceed" | "consolidate" | "decline" };
  proofToken: ProofToken;
  createdAt: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Search response
   ───────────────────────────────────────────────────────────────────── */

export interface SearchResponse {
  query: string;
  records: ComparableRecord[];
  count: number;
  retrievalMs: number;
  retrievalMode: "keyword" | "hybrid";
  embeddingProgress?: { embedded: number; total: number };
}

/* ─────────────────────────────────────────────────────────────────────────
   Source-record detail (for /record/[recordId])
   ───────────────────────────────────────────────────────────────────── */

export interface AmendmentEvent {
  amendmentNumber: number;
  date: string;
  agreementValue: number;
  isCurrent: boolean;
}

export interface RecordDetail extends ComparableRecord {
  amendmentChain: AmendmentEvent[];
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  ownerOrgTitle: string;
}
