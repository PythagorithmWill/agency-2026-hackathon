import type { RiskFlag, RiskSeverity } from "../types/spending";
import type { PatternDef } from "./registry";

export type SignalStrength = RiskSeverity;

/** Four-band severity stored in app.pattern_matches. */
export type Severity = "low" | "medium" | "high" | "critical";

export interface PatternEvidence {
  source: string;
  rowId: string;
  field: string;
  value: string | number | null;
  asOf?: string;
}

export interface PatternMatch {
  patternId: string;
  matchId: string;
  subject: {
    type: "recipient" | "agreement" | "program" | "department";
    id: string;
    canonicalName: string;
  };
  evidence: PatternEvidence[];
  calibratedSummary: string;
  /** Legacy 3-band strength (derived from `severity`; kept for existing UI). */
  signalStrength: SignalStrength;
  /** Four-band severity — the stored value. */
  severity: Severity;
  /** The detector's primary numeric signal (ratio, HHI, years silent, …). */
  signal: number;
  /** Evidence strength in [0, 1] — see strength.ts for the formula. */
  evidenceStrength: number;
  /** Most applicable false-positive note, or null. */
  benignNote: string | null;
  /** Dimensions for filtering; null when not applicable. */
  department: string | null;
  province: string | null;
  fiscalYear: number | null;
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
  /**
   * Server-side statement timeout for the detector's scan. Detectors
   * default to 30–60s (request-path safe); the offline refresh passes a
   * much larger budget so unbounded runs are not cut off.
   */
  statementTimeoutMs?: number;
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

/** Coerce a pg date/timestamp/string value to ISO, or null. */
export function asIso(d: string | Date | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString();
  return String(d);
}

/** Federal fiscal year (Apr–Mar, labelled by END year) for an ISO date. */
export function fiscalYearOf(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 1900) return null;
  return m >= 4 ? y + 1 : y;
}
