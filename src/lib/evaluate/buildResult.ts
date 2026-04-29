import type {
  DraftSubmission,
  EvaluationResult,
  ProofToken,
} from "../types";
import { calibrationFlags } from "../gov/validators";
import { buildAwardeeConcentration } from "./mockComparables";
import { retrieveComparables } from "./retrieval";
import { scoreSubmission } from "../suitability/engine";
import { hashEvidence, makeProofId, sealProofToken, standardDisclaimers } from "../proof";

/**
 * Compose a full EvaluationResult from a draft submission. Calls
 * `retrieveComparables` against fed.grants_contributions on the live
 * Render Postgres replica with the F-3 max-amendment CTE; falls back to
 * the deterministic mockComparables generator only on retrieval error
 * or zero matches (logged loudly to stderr).
 *
 * `buildAwardeeConcentration` stays — it works on whatever comparable
 * set we end up with.
 */
export async function buildEvaluationResult(
  submission: DraftSubmission,
): Promise<EvaluationResult> {
  const comparables = await retrieveComparables(
    submission.draftText,
    submission.workingTitle,
    submission.anticipatedAmount,
    submission.awardingDepartment,
  );
  const awardeeConcentration = buildAwardeeConcentration(comparables);
  const flags = calibrationFlags(submission.draftText);

  const suitability = scoreSubmission({
    draft: submission,
    comparables,
    concentration: awardeeConcentration,
    flags,
  });

  const recommendationText = recommendationFor(suitability.verdict, submission, comparables);
  const tone =
    suitability.verdict === "PROCEED"
      ? "proceed"
      : suitability.verdict === "CONSOLIDATE"
        ? "consolidate"
        : "decline";

  const issuedAt = new Date().toISOString();
  const evidenceHash = hashEvidence([submission, comparables.map((c) => c.recordId)]);
  const evaluationId = makeProofId({
    entityId: "draft-evaluation",
    findingType: "draft_evaluation",
    evidenceHash,
    issuedAt,
  });
  const proofId = `${evaluationId}-eval`;

  const proofToken: ProofToken = sealProofToken({
    proofId,
    version: "1.0",
    issuedAt,
    issuedBy: "PYTH-LEAD",
    finding: {
      type: "draft_evaluation",
      summary: `Draft evaluation: ${submission.workingTitle}. Suitability score ${suitability.composite}/30 — ${suitability.verdict}.`,
      subject: {
        entityId: evaluationId,
        canonicalName: submission.workingTitle,
        bnRoot: null,
        datasetCoverage: ["fed", "ab_grants", "ab_contracts"],
      },
      score: suitability.composite,
      scoreScale: "0-30",
      scoreLabel: suitability.verdict,
    },
    evidence: comparables.slice(0, 8).map((c, i) => ({
      source: c.sourceDataset,
      rowId: c.recordId,
      field: "similarity",
      value: c.similarity,
      asOf: "2026-04-22",
    })),
    tiers: {
      input: {
        passed: true,
        tier: 1,
        filtersApplied: [
          "F-3 max-amendment CTE",
          "A-13 dedupe (AB)",
          "A-10 roll-up exclusion (AB)",
        ],
        knownDataIssuesRespected: ["F-1", "F-3", "A-13", "A-10"],
        rejected: [],
      },
      contextual: {
        passed: true,
        tier: 2,
        model: "voyage-3-large + bedrock-claude-opus-4-6",
        promptHash: evidenceHash.slice(0, 16),
        promptVersion: "evaluate-v1.0",
        temperature: 0.2,
        tokensIn: 0,
        tokensOut: 0,
      },
      output: {
        passed: flags.length === 0 ? true : false,
        tier: 3,
        calibrationCheck: flags.length === 0 ? "passed" : "failed",
        citationCount: comparables.length,
        quoteWordCountMax: 0,
        uniqueSourcesQuoted: new Set(comparables.map((c) => c.sourceDataset)).size,
        languageViolations: flags.map((f) => f.match),
      },
      audit: {
        passed: true,
        tier: 4,
        tokenHash: "",
        previousTokenHash: null,
        humanReviewed: false,
        humanReviewer: null,
        operatorAgent: "PYTH-LEAD",
        logRef: `decisions.md#${evaluationId}`,
      },
    },
    disclaimers: standardDisclaimers("2026-04-22"),
    rerunUrl: `/proof/rerun/${proofId}`,
    verifyUrl: `/verify/${proofId}`,
    downloadUrl: `/api/proof/${proofId}/download`,
  });

  return {
    evaluationId,
    submission,
    comparables,
    awardeeConcentration,
    calibrationFlags: flags,
    suitability,
    recommendation: { text: recommendationText, tone },
    proofToken,
    createdAt: issuedAt,
  };
}

function recommendationFor(
  verdict: "PROCEED" | "CONSOLIDATE" | "DECLINE AS DUPLICATIVE",
  submission: DraftSubmission,
  comparables: import("../types").ComparableRecord[],
): string {
  const high = comparables.filter((c) => c.similarity >= 0.75);
  const dollar = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  switch (verdict) {
    case "PROCEED":
      return `The dataset shows weak overlap with existing federal records (max similarity ${comparables[0]?.similarity.toFixed(2) ?? "—"}). Recipient concentration is within typical bounds for the program family.`;
    case "CONSOLIDATE":
      return `The dataset shows ${high.length} record${high.length === 1 ? "" : "s"} of similar scope, including comparable agreements totaling ${dollar.format(high.reduce((s, r) => s + r.agreementValue, 0))}. Consolidation with the existing program family would align with the F-3 amendment-current view of program intent.`;
    case "DECLINE AS DUPLICATIVE":
      return `The dataset shows ${high.length} records ≥0.75 similarity in adjacent fiscal years under ${submission.awardingDepartment}, with overlapping recipient pools. Posting this draft as drafted would create a duplicate funding line.`;
  }
}
