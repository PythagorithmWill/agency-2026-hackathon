import { query } from "./pool";
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

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function fedCheck(): Promise<SourceHealth> {
  try {
    const { value, ms } = await timed(async () => {
      const r = await query<{ rows: number; latest_fy: number | null }>(
        `SELECT COUNT(*)::int AS rows,
                EXTRACT(YEAR FROM MAX(agreement_start_date))::int AS latest_fy
           FROM fed.grants_contributions`,
      );
      return r.rows[0];
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
      const r = await query<{ rows: number; latest_fy: string | null }>(
        `SELECT COUNT(*)::int AS rows, MAX(display_fiscal_year) AS latest_fy
           FROM ab.ab_grants`,
      );
      return r.rows[0];
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
      const r = await query<{ rows: number; latest_fy: string | null }>(
        `SELECT COUNT(*)::int AS rows, MAX(display_fiscal_year) AS latest_fy
           FROM ab.ab_contracts`,
      );
      return r.rows[0];
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
      const r = await query<{ rows: number }>(
        `SELECT COUNT(*)::int AS rows FROM general.entity_golden_records`,
      );
      return r.rows[0];
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
      const r = await query<{ rows: number }>(
        `SELECT COUNT(*)::int AS rows FROM cra.loop_universe`,
      );
      return r.rows[0];
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

export async function dataSourceHealthCheck(): Promise<HealthCheckReport> {
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
