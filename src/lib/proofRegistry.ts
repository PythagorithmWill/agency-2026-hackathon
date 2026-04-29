import type { ProofToken } from "./types";
import { loadEvaluation } from "./evaluate/store";

/**
 * Resolve a proofId to its issuing context. For tomorrow's product the
 * proofId is either an evaluation token (lookup in the in-memory store)
 * or a chained re-run token (encoded into the URL params).
 */
export function findProofTokenById(
  proofId: string,
): { token: ProofToken; subjectName: string } | null {
  // Strip the "-eval" suffix to get the underlying evaluationId
  const evaluationId = proofId.endsWith("-eval")
    ? proofId.slice(0, -"-eval".length)
    : proofId;
  const evaluation = loadEvaluation(evaluationId);
  if (evaluation && evaluation.proofToken.proofId === proofId) {
    return {
      token: evaluation.proofToken,
      subjectName: evaluation.submission.workingTitle,
    };
  }
  return null;
}
