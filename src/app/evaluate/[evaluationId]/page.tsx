import { notFound } from "next/navigation";
import Link from "next/link";
import { loadEvaluation } from "@/lib/evaluate/store";
import { EvaluationView } from "@/components/evaluate/EvaluationView";

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ evaluationId: string }>;
}) {
  const { evaluationId } = await params;
  const result = loadEvaluation(decodeURIComponent(evaluationId));
  if (!result) notFound();

  return (
    <main>
      <header className="mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Link href={"/" as never} className="hover:text-[var(--color-fg)]">
          ← Pythagorithm
        </Link>
        <Link href={"/evaluate" as never} className="hover:text-[var(--color-fg)]">
          New evaluation
        </Link>
      </header>
      <EvaluationView result={result} />
    </main>
  );
}
