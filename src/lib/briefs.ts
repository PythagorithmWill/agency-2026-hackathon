import { promises as fs } from "node:fs";
import path from "node:path";
import type { OutcomeBrief } from "./types";

const briefsDir = path.join(process.cwd(), "src/data/briefs");

export interface BriefIndexEntry {
  slug: string;
  title: string;
  tag: string;
  briefType: "outcome" | "counterfactual";
}

export async function listCachedBriefs(
  type: "outcome" | "counterfactual",
): Promise<BriefIndexEntry[]> {
  let files: string[];
  try {
    files = await fs.readdir(briefsDir);
  } catch {
    return [];
  }
  const all = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(briefsDir, f), "utf8");
        const brief = JSON.parse(raw) as OutcomeBrief;
        return {
          slug: f.replace(/\.json$/, ""),
          title: brief.subject.canonicalName,
          tag: tagFor(brief),
          briefType: brief.briefType,
        } satisfies BriefIndexEntry;
      }),
  );
  return all
    .filter((b) => b.briefType === type)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadBrief(slug: string): Promise<OutcomeBrief | null> {
  try {
    const raw = await fs.readFile(path.join(briefsDir, `${slug}.json`), "utf8");
    return JSON.parse(raw) as OutcomeBrief;
  } catch {
    return null;
  }
}

function tagFor(brief: OutcomeBrief): string {
  const total = brief.governmentRecords.totalAgreementValue;
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(total);
  const dept = brief.governmentRecords.awardingDepartments[0] ?? "Cross-departmental";
  return `${formatted} · ${dept}`;
}
