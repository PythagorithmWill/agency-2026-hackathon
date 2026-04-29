import { NextResponse } from "next/server";
import { buildEvaluationResult } from "@/lib/evaluate/buildResult";
import { saveEvaluation } from "@/lib/evaluate/store";
import type { DraftSubmission } from "@/lib/types";

const MIN_DRAFT_LENGTH = 40;

export async function POST(request: Request): Promise<Response> {
  let payload: DraftSubmission;
  try {
    payload = (await request.json()) as DraftSubmission;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (
    typeof payload?.draftText !== "string" ||
    payload.draftText.trim().length < MIN_DRAFT_LENGTH ||
    typeof payload.workingTitle !== "string" ||
    payload.workingTitle.trim().length === 0
  ) {
    return NextResponse.json(
      {
        error: "draftText and workingTitle are required; draftText must be at least 40 characters",
      },
      { status: 400 },
    );
  }

  const submission: DraftSubmission = {
    workingTitle: payload.workingTitle.trim(),
    draftText: payload.draftText.trim(),
    awardingDepartment: payload.awardingDepartment ?? "Innovation, Science and Economic Development Canada",
    anticipatedAmount: Number.isFinite(payload.anticipatedAmount) ? payload.anticipatedAmount : 0,
    anticipatedFiscalYear: Number.isFinite(payload.anticipatedFiscalYear) ? payload.anticipatedFiscalYear : 2027,
  };

  const result = await buildEvaluationResult(submission);
  saveEvaluation(result);

  return NextResponse.json({
    evaluationId: result.evaluationId,
    proofId: result.proofToken.proofId,
    verdict: result.suitability.verdict,
    composite: result.suitability.composite,
  });
}
