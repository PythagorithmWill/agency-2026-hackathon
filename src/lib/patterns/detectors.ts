import { fundingLoopsDetector } from "./funding-loops";
import { amendmentPurposeDriftDetector } from "./amendment-purpose-drift";
import { PATTERNS } from "./registry";
import type { PatternDetector } from "./types";

/**
 * Central registry of pattern detectors. Patterns marked status: "live"
 * in the registry but not present here are scaffolding-only — the UI
 * will render the pattern definition + detection signal but will not
 * surface matches.
 */
const REGISTRY: Record<string, PatternDetector> = {
  "funding-loops": fundingLoopsDetector,
  "amendment-purpose-drift": amendmentPurposeDriftDetector,
};

export function getDetector(patternId: string): PatternDetector | null {
  return REGISTRY[patternId] ?? null;
}

export function listLiveDetectors(): PatternDetector[] {
  return PATTERNS
    .filter((p) => REGISTRY[p.id])
    .map((p) => REGISTRY[p.id]);
}
