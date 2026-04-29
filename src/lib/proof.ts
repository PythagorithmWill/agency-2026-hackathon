import { createHash } from "node:crypto";
import type { ProofToken } from "./types";

/**
 * Deterministic Proof token ID — same inputs yield the same ID, so re-running
 * a finding with identical evidence produces a stable proofId.
 */
export function makeProofId(input: {
  entityId: string;
  findingType: string;
  evidenceHash: string;
  issuedAt: string;
}): string {
  const hash = createHash("sha256")
    .update(`${input.entityId}|${input.findingType}|${input.evidenceHash}`)
    .digest("hex")
    .slice(0, 6);
  return `ppm-${input.issuedAt}-${hash}`;
}

export function hashEvidence(evidence: ReadonlyArray<unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(evidence))
    .digest("hex");
}

/**
 * Compute the token hash last and append it. We strip the hash field itself
 * from the input so the hash covers everything else and is verifiable.
 */
export function sealProofToken(token: ProofToken): ProofToken {
  const { tiers, ...rest } = token;
  const { audit, ...nonAuditTiers } = tiers;
  const auditWithoutHash = { ...audit, tokenHash: "" };
  const canonical = JSON.stringify({
    ...rest,
    tiers: { ...nonAuditTiers, audit: auditWithoutHash },
  });
  const tokenHash = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  return {
    ...token,
    tiers: {
      ...tiers,
      audit: { ...audit, tokenHash },
    },
  };
}

/**
 * Standard disclaimers required on every Proof token (PYTH-GOV check 3).
 * The "observations not findings" line is non-negotiable.
 */
export function standardDisclaimers(asOf: string): string[] {
  return [
    `Data current as of ${asOf}`,
    "Entity resolution is probabilistic for cross-dataset matches without BN anchor",
    "These are observations from public records. They are not findings of misconduct.",
  ];
}
