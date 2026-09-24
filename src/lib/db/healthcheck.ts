import { query } from "./pool";
import { FED_FY_SQL } from "../analytics/queries";
import type { DatasetSource } from "../types";

export type SourceStatus = "ok" | "degraded" | "down";

export interface SourceHealth {
  rows: number;
  latest_fy: number | null;
  status: SourceStatus;
  latencyMs: number;
}

export interface HealthCheckReport {
  fed: SourceHealth;
  ab_grants: SourceHealth;
  ab_contracts: SourceHealth;
  general: SourceHealth;
  cra: SourceHealth;
  retrievalLatencyMs: number;
  checkedAt: string;
}

const SLOW_MS = 4000; // beyond this, mark as degraded
const EXPECT = {
  fed: 1_200_000,
  ab_grants: 1_000_000,
  ab_contracts: 50_000,
  general: 700_000,
  cra: 1_000,
};

/**
 * Row count from planner statistics (pg_class.reltuples) instead of COUNT(*).
 * The health pill on every page used to run five full-table counts (~2.5s of
 * DB CPU per page view); estimates are ~1ms and accurate to within ANALYZE
 * drift, which is all "is this source populated" needs. Falls back to
 * COUNT(*) when a table has never been analysed (reltuples = -1).
 */
async function estimateRows(schema: string, table: string): Promise<number> {
  const est = await query<{ n: string | number | null }>(
    `SELECT c.reltuples::bigint AS n
       FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = $1 AND c.relname = $2`,
    [schema, table],
  );
  const n = Number(est.rows[0]?.n ?? -1);
  if (n >= 0) return n;
  const exact = await query<{ n: string | number }>(
    `SELECT COUNT(*)::bigint AS n FROM ${schema}.${table}`,
  );
  return Number(exact.rows[0]?.n ?? 0);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function fedCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      // latest_fy is a federal fiscal-year label (Apr–Mar, end year) per
      // agency2026-data-skill; MAX(agreement_start_date) is index-backed.
      const [rows, fy] = await Promise.all([
        estimateRows("fed", "grants_contributions"),
        query<{ latest_fy: number | null }>(
          `SELECT ${FED_FY_SQL}::int AS latest_fy
             FROM (SELECT MAX(agreement_start_date) AS agreement_start_date
                     FROM fed.grants_contributions) AS latest`,
        ),
      ]);
      return { rows, latest_fy: fy.rows[0]?.latest_fy ?? null };
    });
    return {
      rows: value.rows,
      latest_fy: value.latest_fy,
      status: value.rows >= EXPECT.fed && ms < SLOW_MS ? "ok" : ms >= SLOW_MS ? "degraded" : "down",
      latencyMs: ms,
    };
  } catch {
    return { rows: 0, latest_fy: null, status: "down", latencyMs: 0 };
  }
}

async function abGrantsCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      const [rows, fy] = await Promise.all([
        estimateRows("ab", "ab_grants"),
        query<{ latest_fy: string | null }>(`SELECT MAX(display_fiscal_year) AS latest_fy FROM ab.ab_grants`),
      ]);
      return { rows, latest_fy: fy.rows[0]?.latest_fy ?? null };
    });
    const latestFy = parseFiscalYearLabel(value.latest_fy);
    return {
      rows: value.rows,
      latest_fy: latestFy,
      status: value.rows >= EXPECT.ab_grants && ms < SLOW_MS ? "ok" : ms >= SLOW_MS ? "degraded" : "down",
      latencyMs: ms,
    };
  } catch {
    return { rows: 0, latest_fy: null, status: "down", latencyMs: 0 };
  }
}

async function abContractsCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      const [rows, fy] = await Promise.all([
        estimateRows("ab", "ab_contracts"),
        query<{ latest_fy: string | null }>(`SELECT MAX(display_fiscal_year) AS latest_fy FROM ab.ab_contracts`),
      ]);
      return { rows, latest_fy: fy.rows[0]?.latest_fy ?? null };
    });
    const latestFy = parseFiscalYearLabel(value.latest_fy);
    return {
      rows: value.rows,
      latest_fy: latestFy,
      status: value.rows >= EXPECT.ab_contracts && ms < SLOW_MS ? "ok" : ms >= SLOW_MS ? "degraded" : "down",
      latencyMs: ms,
    };
  } catch {
    return { rows: 0, latest_fy: null, status: "down", latencyMs: 0 };
  }
}

async function generalCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      return { rows: await estimateRows("general", "entity_golden_records") };
    });
    return {
      rows: value.rows,
      latest_fy: null,
      status: value.rows >= EXPECT.general && ms < SLOW_MS ? "ok" : ms >= SLOW_MS ? "degraded" : "down",
      latencyMs: ms,
    };
  } catch {
    return { rows: 0, latest_fy: null, status: "down", latencyMs: 0 };
  }
}

async function craCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      return { rows: await estimateRows("cra", "loop_universe") };
    });
    return {
      rows: value.rows,
      latest_fy: null,
      status: value.rows >= EXPECT.cra && ms < SLOW_MS ? "ok" : ms >= SLOW_MS ? "degraded" : "down",
      latencyMs: ms,
    };
  } catch {
    return { rows: 0, latest_fy: null, status: "down", latencyMs: 0 };
  }
}

/** Convert "2024 - 2025" → 2025 (end-year label per agency2026-data-skill). */
function parseFiscalYearLabel(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return Number(m[2]);
  const m2 = s.match(/(\d{4})/);
  if (m2) return Number(m2[1]);
  return null;
}

/** Memoised for 30s: the footer pill on every page view calls /api/health. */
const HEALTH_MEMO_MS = 30_000;
let healthMemo: { at: number; report: HealthCheckReport } | null = null;

export async function dataSourceHealthCheck(): Promise<HealthCheckReport> {
  if (healthMemo && Date.now() - healthMemo.at < HEALTH_MEMO_MS) return healthMemo.report;
  const report = await dataSourceHealthCheckUncached();
  healthMemo = { at: Date.now(), report };
  return report;
}

async function dataSourceHealthCheckUncached(): Promise<HealthCheckReport> {
  const start = Date.now();
  const [fed, ab_grants, ab_contracts, general, cra] = await Promise.all([
    fedCheck(),
    abGrantsCheck(),
    abContractsCheck(),
    generalCheck(),
    craCheck(),
  ]);
  return {
    fed,
    ab_grants,
    ab_contracts,
    general,
    cra,
    retrievalLatencyMs: Date.now() - start,
    checkedAt: new Date().toISOString(),
  };
}

export const SOURCES: ReadonlyArray<DatasetSource> = [
  "fed",
  "ab_grants",
  "ab_contracts",
];
