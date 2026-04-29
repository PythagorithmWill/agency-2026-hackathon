import Link from "next/link";
import { EvaluateForm } from "@/components/EvaluateForm";

export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialDraft = typeof sp.draft === "string" ? sp.draft : "";

  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Link href={"/" as never} className="hover:text-[var(--color-fg)]">
          ← Pythagorithm
        </Link>
        <Link href={"/methodology" as never} className="hover:text-[var(--color-fg)]">
          Methodology
        </Link>
      </header>
      <EvaluateForm initialDraft={initialDraft} />
    </main>
  );
}
