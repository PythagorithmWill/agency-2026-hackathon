import type { ProofToken } from "./types";
import { loadEvaluation, loadEvaluationByProofId } from "./evaluate/store";
import { isPlausibleId } from "./proof";

/**
 * Resolve a proofId to its issuing context. For tomorrow's product the
 * proofId is either an evaluation token (lookup in the evaluation store)
 * or a chained re-run token (encoded into the URL params).
 */
export async function findProofTokenById(
  proofId: string,
): Promise<{ token: ProofToken; subjectName: string } | null> {
  if (!isPlausibleId(proofId)) return null;
  // Current tokens: look up by proof_id (independent random ID).
  // Legacy tokens ("<evaluationId>-eval", before 2026-09-28): derive the evaluation.
  const evaluation = proofId.endsWith("-eval")
    ? await loadEvaluation(proofId.slice(0, -"-eval".length))
    : await loadEvaluationByProofId(proofId);
  if (evaluation && evaluation.proofToken.proofId === proofId) {
    return {
      token: evaluation.proofToken,
      subjectName: evaluation.submission.workingTitle,
    };
  }
  return null;
}
