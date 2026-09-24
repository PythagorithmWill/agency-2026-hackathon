import { listLiveDetectors } from "@/lib/patterns/detectors";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { buildRecommendations, type Recommendation } from "@/lib/recommendations/build";
import type { PatternMatch } from "@/lib/patterns/types";

/**
 * Snapshot-backed recommendation set, shared by the [id] layout (404 gate)
 * and page. loadSnapshot() is memoised in-process, so calling this from
 * both adds no I/O. Colocated here because layout/page modules may only
 * export Next.js route fields.
 */
export async function loadAllRecommendations(): Promise<Recommendation[]> {
  const snap = await loadSnapshot();
  const detectors = listLiveDetectors();
  const matchesByPattern: Record<string, PatternMatch[]> = {};
  if (snap?.patternMatches) {
    for (const d of detectors) {
      const slug = d.pattern.id;
      matchesByPattern[slug] = (snap.patternMatches[slug] as PatternMatch[]) ?? [];
    }
  }
  return buildRecommendations({
    fundingLoops: matchesByPattern["funding-loops"] ?? [],
    ghostCapacity: matchesByPattern["ghost-capacity"] ?? [],
    zombieRecipients: matchesByPattern["zombie-recipients"] ?? [],
    soleSourceCreep: matchesByPattern["sole-source-creep"] ?? [],
    vendorConcentration: matchesByPattern["vendor-concentration"] ?? [],
    amendmentDrift: matchesByPattern["amendment-purpose-drift"] ?? [],
  });
}
