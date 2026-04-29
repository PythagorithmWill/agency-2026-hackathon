#!/usr/bin/env tsx
/**
 * Slim snapshot augment: reads the existing on-disk snapshot (any
 * version), runs every live pattern detector once, merges the matches
 * into a v3 snapshot. Skips the slow per-department profile rebuild
 * — those fields are preserved from the prior run when present.
 *
 * Use this when you only need fresh pattern matches (which power
 * /follow/[slug] and /recommendations); the heavy aggregations
 * (top departments, programs, concentration, temporal series) usually
 * only change night-to-night and the dept-profile rebuild takes 30+
 * minutes against the contended Render replica.
 *
 * Usage:
 *   npx tsx scripts/augment-snapshot.ts
 */

import { readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

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
    /* .env.local missing — pool will throw a clearer error */
  }
}
loadEnvLocal();

import { listLiveDetectors } from "../src/lib/patterns/detectors";
import {
  SNAPSHOT_VERSION,
  snapshotPath,
  type AnalyticsSnapshot,
} from "../src/lib/analytics/snapshot";
import { closePool } from "../src/lib/db/pool";

const PATTERN_MATCH_LIMIT = 50;

async function main() {
  console.log("Glassbox · augment-snapshot (slim)");
  console.log(`  → ${snapshotPath()}`);

  // Read the existing on-disk snapshot. We accept any prior version
  // and forward its non-detector fields verbatim into v3.
  const raw = readFileSync(snapshotPath(), "utf8");
  const prior = JSON.parse(raw) as Partial<AnalyticsSnapshot> & {
    version: number;
  };
  console.log(`  prior version: v${prior.version} · generatedAt ${prior.generatedAt ?? "?"}`);

  const detectors = listLiveDetectors();
  console.log(`\nRunning ${detectors.length} detectors sequentially...`);

  const patternMatches: Record<string, unknown[]> = {};
  const patternMatchErrors: Record<string, string> = {};
  const overallStart = Date.now();
  const notes: string[] = [...(prior.notes ?? [])];

  for (const det of detectors) {
    const slug = det.pattern.id;
    const start = Date.now();
    try {
      const matches = await det.detect({ limit: PATTERN_MATCH_LIMIT });
      patternMatches[slug] = matches;
      const dur = Date.now() - start;
      console.log(
        `  ✓ ${slug.padEnd(28)} ${dur.toString().padStart(6)}ms  ${matches.length} matches`,
      );
    } catch (err) {
      const dur = Date.now() - start;
      const msg = (err as Error).message;
      patternMatchErrors[slug] = msg;
      patternMatches[slug] = [];
      notes.push(`Pattern detector "${slug}" failed: ${msg}`);
      console.log(
        `  ✗ ${slug.padEnd(28)} ${dur.toString().padStart(6)}ms  ERROR ${msg}`,
      );
    }
  }

  // Forward all prior fields, swap in the fresh detector output, bump
  // version. If the prior file was v2 (lacked the patternMatches /
  // patternMatchErrors fields) the merge fills them in cleanly.
  const next: AnalyticsSnapshot = {
    version: SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    generatedDurationMs: Date.now() - overallStart,
    dataAsOfFy: prior.dataAsOfFy ?? new Date().getFullYear(),

    overview: prior.overview!,
    concentration: prior.concentration!,
    topDepartments: prior.topDepartments ?? [],
    topPrograms: prior.topPrograms ?? [],
    provinceTotals: prior.provinceTotals ?? [],
    recentLarge: prior.recentLarge ?? [],
    amendmentGrowth: prior.amendmentGrowth ?? [],
    temporalSeries: prior.temporalSeries!,
    forecast: prior.forecast ?? null,

    departmentProfiles: prior.departmentProfiles ?? {},

    patternMatches,
    patternMatchErrors,

    notes,
  };

  await fs.writeFile(snapshotPath(), JSON.stringify(next, null, 2), "utf8");
  console.log("");
  console.log(
    `Snapshot v${SNAPSHOT_VERSION} written in ${next.generatedDurationMs}ms (detectors only — aggregations preserved from prior run)`,
  );
  if (notes.length > 0) {
    console.log("Notes:");
    notes.slice(-10).forEach((n) => console.log(`  · ${n}`));
  }

  await closePool();
}

main().catch(async (err) => {
  console.error("Augment failed:", err);
  await closePool();
  process.exit(1);
});
