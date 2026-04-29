import type { EvaluationResult } from "../types";

/**
 * In-memory evaluation store. Survives the lifetime of the Next.js
 * server process. For tomorrow's demo we don't persist evaluations to
 * a database — the whole demo runs against synthesized comparables.
 *
 * Cleared on server restart. That's intentional.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pythStore: Map<string, EvaluationResult> | undefined;
}

const store: Map<string, EvaluationResult> =
  globalThis.__pythStore ?? (globalThis.__pythStore = new Map());

export function saveEvaluation(e: EvaluationResult): void {
  store.set(e.evaluationId, e);
}

export function loadEvaluation(id: string): EvaluationResult | null {
  return store.get(id) ?? null;
}

export function recentEvaluations(limit = 10): EvaluationResult[] {
  return Array.from(store.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
