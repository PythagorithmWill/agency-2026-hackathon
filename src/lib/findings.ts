import { promises as fs } from "node:fs";
import path from "node:path";
import type { FindingCard } from "./types";

const dataPath = path.join(process.cwd(), "src/data/findings.json");

/**
 * Cache-first reader. Tonight's build uses the static JSON authored from
 * the prewarm cache + manual review. At runtime we can swap in a DB-backed
 * version without changing the call sites.
 */
export async function getCachedFindings(): Promise<FindingCard[]> {
  const raw = await fs.readFile(dataPath, "utf8");
  return JSON.parse(raw) as FindingCard[];
}

export async function getFindingByEntity(
  entitySlug: string,
): Promise<FindingCard | null> {
  const findings = await getCachedFindings();
  return (
    findings.find(
      (f) =>
        slugify(f.proofToken.finding.subject.canonicalName) === entitySlug,
    ) ?? null
  );
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
