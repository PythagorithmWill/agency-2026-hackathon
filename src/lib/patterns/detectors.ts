import { fundingLoopsDetector } from "./funding-loops";
import { amendmentPurposeDriftDetector } from "./amendment-purpose-drift";
import { soleSourceCreepDetector } from "./sole-source-creep";
import { zombieRecipientsDetector } from "./zombie-recipients";
import { vendorConcentrationDetector } from "./vendor-concentration";
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
  "sole-source-creep": soleSourceCreepDetector,
  "zombie-recipients": zombieRecipientsDetector,
  "vendor-concentration": vendorConcentrationDetector,
};

export function getDetector(patternId: string): PatternDetector | null {
  return REGISTRY[patternId] ?? null;
}

export function listLiveDetectors(): PatternDetector[] {
  return PATTERNS
    .filter((p) => REGISTRY[p.id])
    .map((p) => REGISTRY[p.id]);
}
