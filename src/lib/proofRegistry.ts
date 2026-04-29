import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProofToken, OutcomeBrief, FindingCard } from "./types";

/**
 * Server-side lookup of any Proof token by its proofId, scanning the
 * cached findings + briefs. Used by /proof/rerun/[proofId] and the
 * download API route.
 */
export async function findProofTokenById(
  proofId: string,
): Promise<{ token: ProofToken; source: "finding" | "brief"; subjectName: string } | null> {
  const findingsPath = path.join(process.cwd(), "src/data/findings.json");
  try {
    const raw = await fs.readFile(findingsPath, "utf8");
    const findings = JSON.parse(raw) as FindingCard[];
    const hit = findings.find((f) => f.proofToken.proofId === proofId);
    if (hit) {
      return {
        token: hit.proofToken,
        source: "finding",
        subjectName: hit.proofToken.finding.subject.canonicalName,
      };
    }
  } catch {
    /* fall through */
  }

  const briefsDir = path.join(process.cwd(), "src/data/briefs");
  try {
    const files = await fs.readdir(briefsDir);
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const raw = await fs.readFile(path.join(briefsDir, f), "utf8");
      const brief = JSON.parse(raw) as OutcomeBrief;
      if (brief.proofToken.proofId === proofId) {
        return {
          token: brief.proofToken,
          source: "brief",
          subjectName: brief.subject.canonicalName,
        };
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}
