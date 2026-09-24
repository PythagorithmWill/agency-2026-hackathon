import { NextResponse } from "next/server";
import { buildEvaluationResult } from "@/lib/evaluate/buildResult";
import { saveEvaluation } from "@/lib/evaluate/store";
import type { DraftSubmission } from "@/lib/types";

const MIN_DRAFT_LENGTH = 40;
// Upper bounds: the draft text seeds a corpus retrieval query and the
// whole submission is held in the in-memory evaluation store, so an
// unbounded body is both a DB-load and a memory-growth vector.
const MAX_DRAFT_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 300;
const MAX_DEPT_LENGTH = 300;
const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_DEPARTMENT = "Innovation, Science and Economic Development Canada";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function bad(error: string, status = 400): Response {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad(`request body exceeds ${MAX_BODY_BYTES} bytes`, 413);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return bad("invalid JSON body");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return bad("request body must be a JSON object");
  }
  const p = payload as Partial<Record<keyof DraftSubmission, unknown>>;

  if (
    typeof p.draftText !== "string" ||
    p.draftText.trim().length < MIN_DRAFT_LENGTH ||
    typeof p.workingTitle !== "string" ||
    p.workingTitle.trim().length === 0
  ) {
    return bad(
      `draftText and workingTitle are required; draftText must be at least ${MIN_DRAFT_LENGTH} characters`,
    );
  }
  if (p.draftText.length > MAX_DRAFT_LENGTH) {
    return bad(`draftText must be at most ${MAX_DRAFT_LENGTH} characters`);
  }
  if (p.workingTitle.length > MAX_TITLE_LENGTH) {
    return bad(`workingTitle must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  // Non-string departments used to reach retrieval's normalizeDept() and
  // crash with "d.trim is not a function" (HTTP 500).
  if (p.awardingDepartment !== undefined && typeof p.awardingDepartment !== "string") {
    return bad("awardingDepartment must be a string when provided");
  }
  const awardingDepartment =
    typeof p.awardingDepartment === "string" && p.awardingDepartment.trim().length > 0
      ? p.awardingDepartment.trim().slice(0, MAX_DEPT_LENGTH)
      : DEFAULT_DEPARTMENT;

  const amount = typeof p.anticipatedAmount === "number" ? p.anticipatedAmount : 0;
  const fy = typeof p.anticipatedFiscalYear === "number" ? p.anticipatedFiscalYear : 2027;

  const submission: DraftSubmission = {
    workingTitle: p.workingTitle.trim(),
    draftText: p.draftText.trim(),
    awardingDepartment,
    anticipatedAmount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    anticipatedFiscalYear:
      Number.isInteger(fy) && fy >= 1990 && fy <= 2100 ? fy : 2027,
  };

  let result;
  try {
    result = await buildEvaluationResult(submission);
  } catch (err) {
    console.error("[api/draft/evaluate] evaluation failed:", (err as Error).message);
    return bad("evaluation_failed", 500);
  }
  saveEvaluation(result);

  return NextResponse.json(
    {
      evaluationId: result.evaluationId,
      proofId: result.proofToken.proofId,
      verdict: result.suitability.verdict,
      composite: result.suitability.composite,
    },
    { headers: NO_STORE },
  );
}
