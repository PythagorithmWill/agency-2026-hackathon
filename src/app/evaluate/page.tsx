import { EvaluateForm } from "@/components/EvaluateForm";

export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialDraft = typeof sp.draft === "string" ? sp.draft : "";

  return (
    <main className="min-h-screen pt-16">
      <EvaluateForm initialDraft={initialDraft} />
    </main>
  );
}
