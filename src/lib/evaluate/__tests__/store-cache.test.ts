import { describe, expect, it, beforeAll } from "vitest";
import type { EvaluationResult } from "../../types";

beforeAll(() => {
  // Memory-only store: no database is touched.
  delete process.env.DATABASE_URL;
});

function fake(i: number): EvaluationResult {
  return {
    evaluationId: `ev-test-${i}`,
    createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    proofToken: { proofId: `pf-test-${i}` },
    submission: { workingTitle: `t${i}` },
  } as unknown as EvaluationResult;
}

describe("evaluation store cache", () => {
  it("saves and reloads by evaluation and proof id without recursion", async () => {
    const { saveEvaluation, loadEvaluation, loadEvaluationByProofId } = await import("../store");
    await saveEvaluation(fake(1));
    expect((await loadEvaluation("ev-test-1"))?.evaluationId).toBe("ev-test-1");
    expect((await loadEvaluationByProofId("pf-test-1"))?.evaluationId).toBe("ev-test-1");
  });
  it("caps the in-process cache at 500 entries, evicting the oldest", async () => {
    const { saveEvaluation, loadEvaluation } = await import("../store");
    for (let i = 2; i <= 620; i++) await saveEvaluation(fake(i));
    expect(await loadEvaluation("ev-test-2")).toBeNull();
    expect((await loadEvaluation("ev-test-620"))?.evaluationId).toBe("ev-test-620");
  });
});
