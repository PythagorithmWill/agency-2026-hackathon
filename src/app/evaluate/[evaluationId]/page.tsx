import { notFound } from "next/navigation";
import { loadEvaluation } from "@/lib/evaluate/store";
import { EvaluationView } from "@/components/evaluate/EvaluationView";

export const metadata = { title: "Evaluation — Glassbox" };

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ evaluationId: string }>;
}) {
  const { evaluationId } = await params;
  const result = await loadEvaluation(decodeURIComponent(evaluationId));
  if (!result) notFound();

  return (
    <main className="pt-16">
      <EvaluationView result={result} />
    </main>
  );
}
