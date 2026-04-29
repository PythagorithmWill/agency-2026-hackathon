#!/usr/bin/env tsx
/**
 * Precompute every aggregation that the /transparency dashboard needs
 * and persist it to data/analytics-snapshot.json. Run nightly (or
 * before each demo).
 *
 * Usage:
 *   npx tsx scripts/build-snapshot.ts
 *
 * Auto-loads DATABASE_URL from .env.local (the Next.js convention).
 * Override by exporting DATABASE_URL in the shell first.
 *
 * Each query runs through `longQuery` with a per-statement timeout
 * raised to 60s. The whole pipeline runs sequentially (not in parallel)
 * so we don't blow through the 10-connection pool.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local before anything else imports the pool.
function loadEnvLocal() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (!m) continue;
      const [, key, valRaw] = m;
      const val = valRaw.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local missing — fall through; pool will throw a clearer error
  }
}
loadEnvLocal();

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
  loadDepartmentRecipients,
  loadDepartmentPrograms,
} from "../src/lib/analytics/queries";
import {
  SNAPSHOT_VERSION,
  writeSnapshot,
  snapshotPath,
  type AnalyticsSnapshot,
  type DepartmentProfileSnapshot,
} from "../src/lib/analytics/snapshot";
import { closePool } from "../src/lib/db/pool";

const TOP_DEPT_PROFILE_COUNT = 15;

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

  // Per-department profiles for the top N departments.
  console.log(`\nBuilding per-department profiles (top ${TOP_DEPT_PROFILE_COUNT})...`);
  const departmentProfiles: Record<string, DepartmentProfileSnapshot> = {};
  const top = (topDepts.value ?? []).slice(0, TOP_DEPT_PROFILE_COUNT);
  for (const d of top) {
    const recipients = await timed(`  recipients(${d.department.slice(0, 30)})`, () =>
      loadDepartmentRecipients(d.department, 25, "long"),
    );
    const programs = await timed(`  programs (${d.department.slice(0, 30)})`, () =>
      loadDepartmentPrograms(d.department, 25, "long"),
    );
    const deptSeries = await timed(`  series   (${d.department.slice(0, 30)})`, () =>
      loadTemporalSeriesFed({ department: d.department, budget: "long" }),
    );
    const deptForecast = await timed(`  forecast (${d.department.slice(0, 30)})`, () =>
      loadForecastFed({ department: d.department, forwardYears: 3, budget: "long" }),
    );
    if (!recipients.ok) notes.push(`Dept profile recipients failed for ${d.department}: ${recipients.error}`);
    if (!programs.ok) notes.push(`Dept profile programs failed for ${d.department}: ${programs.error}`);
    if (!deptSeries.ok) notes.push(`Dept profile series failed for ${d.department}: ${deptSeries.error}`);

    departmentProfiles[d.department] = {
      department: d.department,
      totalSpend: d.total,
      agreementCount: d.agreementCount,
      recipientCount: d.recipientCount,
      programCount: 0,
      topRecipients: (recipients.value ?? []).map((r) => ({
        recipient: r.recipient,
        bn: r.bn,
        total: r.total,
        agreementCount: r.agreementCount,
      })),
      topPrograms: programs.value ?? [],
      temporalSeries: deptSeries.value ?? { bySeries: d.department, points: [] },
      forecast: deptForecast.value ?? null,
    };
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

    departmentProfiles,

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
