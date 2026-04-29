#!/usr/bin/env tsx
/**
 * Precompute every aggregation that the /transparency dashboard needs
 * and persist it to data/analytics-snapshot.json. Run nightly (or
 * before each demo).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/build-snapshot.ts
 *
 * Each query runs through `longQuery` with a per-statement timeout
 * raised to 60s. The whole pipeline runs sequentially (not in parallel)
 * so we don't blow through the 10-connection pool.
 */

import {
  loadOverviewStats,
  loadTopDepartmentsFed,
  loadTopProgramsFed,
  loadProvinceTotalsFed,
  loadRecentLargeFed,
  scanAmendmentGrowthFed,
  loadTemporalSeriesFed,
  loadForecastFed,
  loadConcentrationFed,
} from "../src/lib/analytics/queries";
import {
  SNAPSHOT_VERSION,
  writeSnapshot,
  snapshotPath,
  type AnalyticsSnapshot,
} from "../src/lib/analytics/snapshot";
import { closePool } from "../src/lib/db/pool";

interface RunResult<T> {
  name: string;
  durationMs: number;
  ok: boolean;
  value?: T;
  error?: string;
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<RunResult<T>> {
  const start = Date.now();
  try {
    const value = await fn();
    const durationMs = Date.now() - start;
    const summary = Array.isArray(value) ? `${value.length} rows` : "ok";
    console.log(`  ✓ ${name.padEnd(28)} ${durationMs.toString().padStart(6)}ms  ${summary}`);
    return { name, durationMs, ok: true, value };
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = (err as Error).message;
    console.log(`  ✗ ${name.padEnd(28)} ${durationMs.toString().padStart(6)}ms  ERROR ${error}`);
    return { name, durationMs, ok: false, error };
  }
}

async function main() {
  console.log("Glassbox · build-snapshot");
  console.log(`  → ${snapshotPath()}`);
  console.log("");
  const overallStart = Date.now();
  const notes: string[] = [];

  const overview = await timed("loadOverviewStats", () => loadOverviewStats("long"));
  const topDepts = await timed("loadTopDepartmentsFed(50)", () =>
    loadTopDepartmentsFed(50, "long"),
  );
  const topProgs = await timed("loadTopProgramsFed(50)", () =>
    loadTopProgramsFed(50, "long"),
  );
  const provinces = await timed("loadProvinceTotalsFed", () =>
    loadProvinceTotalsFed("long"),
  );
  const recent = await timed("loadRecentLargeFed(5M, 30)", () =>
    loadRecentLargeFed(5_000_000, 30, "long"),
  );
  const growth = await timed("scanAmendmentGrowthFed(2.0,50)", () =>
    scanAmendmentGrowthFed(2.0, 50, "long"),
  );
  const concentration = await timed("loadConcentrationFed(25k)", () =>
    loadConcentrationFed({ limit: 25_000, budget: "long" }),
  );
  const series = await timed("loadTemporalSeriesFed", () =>
    loadTemporalSeriesFed({ budget: "long" }),
  );
  const forecast = await timed("loadForecastFed(3y)", () =>
    loadForecastFed({ forwardYears: 3, budget: "long" }),
  );

  // Surface partial failures
  for (const r of [
    overview,
    topDepts,
    topProgs,
    provinces,
    recent,
    growth,
    concentration,
    series,
    forecast,
  ]) {
    if (!r.ok) notes.push(`Query "${r.name}" failed: ${r.error}`);
  }

  if (!overview.ok || !concentration.ok || !series.ok) {
    console.error("\nFatal: critical aggregation failed; aborting snapshot write.");
    await closePool();
    process.exit(1);
  }

  const dataAsOfFy =
    series.value && series.value.points.length > 0
      ? series.value.points[series.value.points.length - 1].fy
      : new Date().getFullYear();

  const snap: AnalyticsSnapshot = {
    version: SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    generatedDurationMs: Date.now() - overallStart,
    dataAsOfFy,

    overview: overview.value!,
    concentration: concentration.value!,
    topDepartments: topDepts.value ?? [],
    topPrograms: topProgs.value ?? [],
    provinceTotals: provinces.value ?? [],
    recentLarge: recent.value ?? [],
    amendmentGrowth: growth.value ?? [],
    temporalSeries: series.value!,
    forecast: forecast.value ?? null,

    notes,
  };

  await writeSnapshot(snap);
  console.log("");
  console.log(`Snapshot v${SNAPSHOT_VERSION} written in ${snap.generatedDurationMs}ms`);
  console.log(`Data as of FY${snap.dataAsOfFy}`);
  if (notes.length > 0) {
    console.log("Notes:");
    notes.forEach((n) => console.log(`  · ${n}`));
  }

  await closePool();
}

main().catch(async (err) => {
  console.error("Snapshot build failed:", err);
  await closePool();
  process.exit(1);
});
