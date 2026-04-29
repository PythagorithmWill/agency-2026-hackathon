import type { RiskFlag, RiskSeverity } from "../types/spending";
import type { PatternDef } from "./registry";

export type SignalStrength = RiskSeverity;

export interface PatternMatch {
  patternId: string;
  matchId: string;
  subject: {
    type: "recipient" | "agreement" | "program" | "department";
    id: string;
    canonicalName: string;
  };
  evidence: Array<{
    source: string;
    rowId: string;
    field: string;
    value: string | number | null;
    asOf?: string;
  }>;
  calibratedSummary: string;
  signalStrength: SignalStrength;
  detectedAt: string;
  /** Optional: a fully-formed RiskFlag wrapper for the match. */
  riskFlag?: RiskFlag;
}

export interface PatternFilters {
  /** Limit number of matches returned. */
  limit?: number;
  /** Minimum signal strength. observation < attention < flag. */
  minSignal?: SignalStrength;
  /** Restrict to matches with subject.id matching this value (e.g. a single BN). */
  subjectId?: string;
}

export interface PatternDetector {
  pattern: PatternDef;
  detect: (filters?: PatternFilters) => Promise<PatternMatch[]>;
}

const RANK: Record<SignalStrength, number> = {
  observation: 0,
  attention: 1,
  flag: 2,
};

export function meetsMinSignal(
  s: SignalStrength,
  min?: SignalStrength,
): boolean {
  if (!min) return true;
  return RANK[s] >= RANK[min];
}
