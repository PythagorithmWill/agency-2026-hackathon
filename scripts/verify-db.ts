/**
 * Verify the Render Postgres replica is reachable and the canonical row
 * counts match expectations. Run before any other DB-touching script.
 *
 * Usage: npm run verify-db
 */
import { query, closePool } from "../src/lib/db/pool";

interface Check {
  label: string;
  sql: string;
  expectedAtLeast: number;
}

const checks: Check[] = [
  { label: "general.entity_golden_records",       sql: "SELECT COUNT(*)::int AS n FROM general.entity_golden_records",     expectedAtLeast: 700_000 },
  { label: "fed.grants_contributions",            sql: "SELECT COUNT(*)::int AS n FROM fed.grants_contributions",          expectedAtLeast: 1_200_000 },
  { label: "cra.t3010_impossibilities",           sql: "SELECT COUNT(*)::int AS n FROM cra.t3010_impossibilities",         expectedAtLeast: 50_000 },
  { label: "cra.t3010_plausibility_flags",        sql: "SELECT COUNT(*)::int AS n FROM cra.t3010_plausibility_flags",      expectedAtLeast: 1_000 },
  { label: "cra.loops",                            sql: "SELECT COUNT(*)::int AS n FROM cra.loops",                          expectedAtLeast: 5_500 },
  { label: "cra.loop_universe",                    sql: "SELECT COUNT(*)::int AS n FROM cra.loop_universe",                  expectedAtLeast: 1_400 },
];

async function main(): Promise<void> {
  let allPassed = true;
  console.log("Verifying Render Postgres replica row counts...\n");

  for (const c of checks) {
    try {
      const start = Date.now();
      const r = await query<{ n: number }>(c.sql);
      const ms = Date.now() - start;
      const n = r.rows[0]?.n ?? 0;
      const passed = n >= c.expectedAtLeast;
      const tag = passed ? "PASS" : "FAIL";
      console.log(`  [${tag}] ${c.label.padEnd(40)} ${n.toLocaleString().padStart(12)}  (${ms}ms)`);
      if (!passed) allPassed = false;
    } catch (err) {
      console.log(`  [ERR ] ${c.label.padEnd(40)} ${(err as Error).message}`);
      allPassed = false;
    }
  }

  await closePool();
  if (!allPassed) {
    console.error("\nOne or more checks failed. Inspect output before proceeding.");
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
