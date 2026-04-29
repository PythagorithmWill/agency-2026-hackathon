import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ConcentrationReport,
  TemporalSeries,
  ForecastResult,
} from "../types/spending";
import type {
  DepartmentTotal,
  ProgramTotal,
  ProvinceTotal,
  RecentAgreement,
  AmendmentGrowthRow,
  OverviewStats,
} from "./queries";

/**
 * Aggregations precomputed by `scripts/build-snapshot.ts` and persisted
 * to `data/analytics-snapshot.json`. The dashboard pages read this
 * snapshot at request time; the F-3 max-amendment CTE on the full corpus
 * takes ~10s which exceeds the 8s pool budget, so heavy aggregations
 * are precomputed offline.
 *
 * Refresh cadence: nightly. The methodology page discloses the lag.
 *
 * Schema is versioned. Breaking changes increment SNAPSHOT_VERSION;
 * the dashboard refuses to render against a mismatched snapshot.
 */
export const SNAPSHOT_VERSION = 3;

export interface DepartmentProfileSnapshot {
  department: string;
  totalSpend: number;
  agreementCount: number;
  recipientCount: number;
  programCount: number;
  topRecipients: Array<{
    recipient: string;
    bn: string | null;
    total: number;
    agreementCount: number;
  }>;
  topPrograms: Array<{
    program: string;
    total: number;
    agreementCount: number;
  }>;
  temporalSeries: TemporalSeries;
  forecast: ForecastResult | null;
}

export interface AnalyticsSnapshot {
  version: number;
  generatedAt: string;
  generatedDurationMs: number;
  dataAsOfFy: number;

  overview: OverviewStats;
  concentration: ConcentrationReport;
  topDepartments: DepartmentTotal[];
  topPrograms: ProgramTotal[];
  provinceTotals: ProvinceTotal[];
  recentLarge: RecentAgreement[];
  amendmentGrowth: AmendmentGrowthRow[];
  temporalSeries: TemporalSeries;
  forecast: ForecastResult | null;

  /**
   * Per-department profiles for the top 15 departments by spend.
   * Keyed by exact department name (matches owner_org_title).
   */
  departmentProfiles: Record<string, DepartmentProfileSnapshot>;

  /**
   * Precomputed pattern-match output, keyed by pattern slug. Built
   * by scripts/build-snapshot.ts running each live detector
   * sequentially under the long pool. /follow/[slug] and
   * /recommendations read from here so the request path doesn't hit
   * the DB at all.
   */
  patternMatches: Record<string, unknown[]>;
  patternMatchErrors: Record<string, string>;

  /**
   * Notes from the precompute run — partial failures, count anomalies,
   * downgrade reasons. Surfaced in the methodology page.
   */
  notes: string[];
}

const SNAPSHOT_PATH = path.resolve(process.cwd(), "data/analytics-snapshot.json");

let memoCache: AnalyticsSnapshot | null = null;

export async function loadSnapshot(): Promise<AnalyticsSnapshot | null> {
  if (memoCache) return memoCache;
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as AnalyticsSnapshot;
    if (parsed.version !== SNAPSHOT_VERSION) {
      console.warn(
        `[snapshot] version mismatch: file is v${parsed.version}, code expects v${SNAPSHOT_VERSION}`,
      );
      return null;
    }
    memoCache = parsed;
    return parsed;
  } catch (err) {
    console.warn(
      "[snapshot] read failed (run scripts/build-snapshot.ts):",
      (err as Error).message,
    );
    return null;
  }
}

export async function writeSnapshot(snap: AnalyticsSnapshot): Promise<void> {
  const dir = path.dirname(SNAPSHOT_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snap, null, 2), "utf8");
}

export function snapshotPath(): string {
  return SNAPSHOT_PATH;
}
