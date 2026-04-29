/**
 * Unified spending model. Spans federal grants & contributions, Alberta
 * provincial grants, Alberta provincial contracts, lobbying registrations,
 * political contributions, and any future BigEhBrother source.
 *
 * Every record carries provenance — sourceDataset + sourceRowId +
 * sourceUrl (where available) + retrievedAt — so the audit trail can
 * always be re-walked.
 */

import type { DatasetSource } from "../types";

export type Jurisdiction = "federal" | "alberta" | "mixed" | "other";

export type RecipientType =
  | "for_profit"
  | "non_profit"
  | "charity"
  | "indigenous_org"
  | "government"
  | "individual"
  | "foreign"
  | "academic"
  | "unknown";

export interface SpendingRecord {
  recordId: string;
  sourceDataset: DatasetSource | string;
  sourceJurisdiction: Jurisdiction;

  // Money flow
  fundingDepartment: string;
  fundingProgram: string | null;
  budgetEnvelope: string | null;
  recipientLegalName: string;
  recipientBN: string | null;
  recipientType: RecipientType | null;
  recipientProvince: string | null;
  recipientCity: string | null;

  // Amount
  agreementValue: number;
  amendmentNumber: number | null;
  isCurrentAmendment: boolean;

  // Time
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  fiscalYearStart: number;
  fiscalYearEnd: number;

  // Description
  description: string | null;
  expectedResults: string | null;
  programObjective: string | null;

  // Provenance
  sourceUrl: string | null;
  sourceRowId: string;
  retrievedAt: string;
}

/**
 * RiskFlag — every detected pattern carries a flagType, severity, evidence
 * array, and calibrated summary. Upstream/downstream linkage tracked as
 * flagId references.
 */
export type RiskFlagType =
  | "concentration_high"
  | "duplication_suspected"
  | "amendment_growth"
  | "recipient_capture"
  | "geographic_skew"
  | "language_calibration"
  | "temporal_clustering"
  | "cross_jurisdiction_overlap"
  | "lobbying_correlation"
  | "donation_correlation"
  | "charity_loop"
  | "amendment_purpose_drift";

export type RiskSeverity = "observation" | "attention" | "flag";

export interface RiskFlag {
  flagId: string;
  flagType: RiskFlagType;
  severity: RiskSeverity;
  subject: { entityId: string; canonicalName: string; entityType: "recipient" | "program" | "department" };
  evidence: Array<{
    source: string;
    rowId: string;
    field: string;
    value: string | number | null;
  }>;
  calibratedSummary: string;
  upstreamLinks: string[];
  downstreamLinks: string[];
  detectedAt: string;
}

/* ─── Analytics output shapes ────────────────────────────────────────── */

export interface ConcentrationReport {
  totalSpend: number;
  recipientCount: number;
  agreementCount: number;
  hhi: number; // Herfindahl-Hirschman Index, 0..10000
  gini: number; // Gini coefficient, 0..1
  median: number;
  mean: number;
  top10: Array<{
    recipient: string;
    bn: string | null;
    total: number;
    share: number;
    agreementCount: number;
  }>;
  decileBreakdown: Array<{ decile: number; share: number }>;
}

export interface TemporalSeries {
  bySeries: string;
  points: Array<{
    fy: number;
    total: number;
    recipientCount: number;
    programCount: number;
    agreementCount: number;
  }>;
}

export interface ForecastResult {
  series: string;
  historical: Array<{ fy: number; value: number }>;
  forecast: Array<{
    fy: number;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }>;
  method: string;
  rSquared: number;
  trend: "growing" | "flat" | "shrinking";
  trendConfidence: number;
}

export interface AmendmentTrajectory {
  recordId: string;
  initial: { value: number; date: string | null };
  current: { value: number; date: string | null };
  amendments: Array<{
    amendmentNumber: number;
    value: number;
    date: string | null;
    delta: number;
    description: string | null;
  }>;
  totalGrowth: number;
  totalGrowthPercent: number;
  flags: RiskFlag[];
}

export interface DepartmentProfile {
  jurisdiction: Jurisdiction;
  name: string;
  totalSpend: number;
  recipientCount: number;
  programCount: number;
  agreementCount: number;
  fyRange: { start: number; end: number };
  topRecipients: ConcentrationReport["top10"];
  hhi: number;
  trajectory: TemporalSeries;
  forecast: ForecastResult | null;
}

export interface RecipientProfile {
  legalName: string;
  bn: string | null;
  type: RecipientType | null;
  totalReceived: number;
  bySource: Partial<Record<DatasetSource, number>>;
  byDepartment: Array<{ department: string; jurisdiction: Jurisdiction; total: number; agreementCount: number }>;
  byProgram: Array<{ program: string; total: number; agreementCount: number }>;
  agreements: SpendingRecord[];
  trajectory: TemporalSeries;
  flags: RiskFlag[];
}
