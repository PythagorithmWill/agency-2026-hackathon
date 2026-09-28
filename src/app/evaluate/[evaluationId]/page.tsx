import { notFound } from "next/navigation";
import { loadEvaluation } from "@/lib/evaluate/store";
import { EvaluationView } from "@/components/evaluate/EvaluationView";
import { decodeParam } from "@/lib/params";
import { isPlausibleId } from "@/lib/proof";

export const metadata = { title: "Evaluation — Glassbox" };

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ evaluationId: string }>;
}) {
  const { evaluationId } = await params;
  const id = decodeParam(evaluationId);
  if (id === null || !isPlausibleId(id)) notFound();
  const result = await loadEvaluation(id);
  if (!result) notFound();

  return (
    <main className="pt-16">
      <EvaluationView result={result} />
    </main>
  );
}
