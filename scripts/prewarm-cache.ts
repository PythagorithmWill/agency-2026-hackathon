/**
 * Prewarm cache — pulls the 10 demo seed entities from the Render replica
 * and writes them to cache/seed-entities.json so the demo serves the most
 * likely lookups in <50ms regardless of conference WiFi state.
 *
 * NEVER commit cache/seed-entities.json — it's in .gitignore. Regenerate
 * tomorrow morning before the demo if the snapshot has aged.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { query, closePool } from "../src/lib/db/pool";

interface Seed {
  name: string;
  bn?: string;
  tier: "A" | "B";
}

const seeds: Seed[] = [
  { name: "WE Charity Foundation", bn: "118810988", tier: "A" },
  { name: "Sustainable Development Technology Canada", tier: "A" },
  { name: "Canada World Youth", bn: "119262518", tier: "A" },
  { name: "Halagonia Tidal Energy", tier: "A" },
  { name: "TMT International Observatory", tier: "A" },
  { name: "Carisbrooke Shipping", tier: "A" },
  // Counterfactual showcases — placeholders; PYTH-RES finalises the picks
  // from the live Description-NULL-and-amount-over-1M scan tomorrow morning
  { name: "Strategic Innovation Fund (FY2024 description-null showcase)", tier: "B" },
  { name: "Smart Renewables and Electrification Pathways (FY2025 showcase)", tier: "B" },
  { name: "Indigenous Services FNIH (FY2025 showcase)", tier: "B" },
  { name: "CMHC National Housing Co-Investment Fund (FY2025 showcase)", tier: "B" },
];

async function prewarm(seed: Seed): Promise<unknown> {
  const ilike = `%${seed.name}%`;
  const [golden, loops, agreements, violations] = await Promise.all([
    query(
      `SELECT entity_id, canonical_name, bn_root, dataset_sources, addresses
         FROM general.entity_golden_records
        WHERE canonical_name ILIKE $1
           OR ($2::text IS NOT NULL AND bn_root = $2)
        LIMIT 5`,
      [ilike, seed.bn ?? null],
    ),
    query(
      `SELECT lu.loop_id, lu.score, lu.hops
         FROM cra.loop_universe lu
         JOIN cra.loop_participants lp USING (loop_id)
         JOIN general.entity_golden_records e ON e.bn_root = lp.bn
        WHERE e.canonical_name ILIKE $1
        ORDER BY lu.score DESC
        LIMIT 25`,
      [ilike],
    ),
    query(
      `WITH ac AS (
         SELECT DISTINCT ON (ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text))
                _id, ref_number, recipient_legal_name, recipient_business_number,
                agreement_value, agreement_start_date, prog_name_en, owner_org_title,
                description_en
           FROM fed.grants_contributions
          WHERE recipient_legal_name ILIKE $1
             OR ($2::text IS NOT NULL AND recipient_business_number = $2)
          ORDER BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text),
                   NULLIF(amendment_number, '')::int DESC NULLS LAST, _id DESC
       )
       SELECT * FROM ac
       ORDER BY agreement_value DESC NULLS LAST
       LIMIT 100`,
      [ilike, seed.bn ?? null],
    ),
    query(
      `SELECT bn, COUNT(*) AS arithmetic_violations
         FROM cra.t3010_impossibilities ti
         JOIN general.entity_golden_records e ON e.bn_root = ti.bn
        WHERE e.canonical_name ILIKE $1
        GROUP BY 1
        LIMIT 10`,
      [ilike],
    ),
  ]);

  return {
    seed,
    goldenRecord: golden.rows,
    loops: loops.rows,
    agreements: agreements.rows,
    violations: violations.rows,
    cachedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  console.log(`Prewarming ${seeds.length} seed entities...`);
  const cache: Record<string, unknown> = {};
  for (const seed of seeds) {
    process.stdout.write(`  ${seed.name} ... `);
    try {
      cache[seed.name] = await prewarm(seed);
      console.log("ok");
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
    }
  }

  const outDir = path.join(process.cwd(), "cache");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "seed-entities.json");
  await fs.writeFile(outFile, JSON.stringify(cache, null, 2), "utf8");

  const stat = await fs.stat(outFile);
  console.log(
    `\nWrote ${outFile}  (${(stat.size / 1024).toFixed(1)} KB, ${Object.keys(cache).length} entities)`,
  );
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
