import { notFound } from "next/navigation";
import { ClassicNav } from "@/components/ClassicNav";
import { Brief } from "@/components/Brief";
import { loadBrief } from "@/lib/briefs";

/**
 * /cached/{slug}/{surface} — failover-served pre-rendered briefs. Identical
 * content to /outcome/{slug} or /counterfactual/{slug} but served from
 * static data with no DB or LLM dependency.
 *
 * PYTH-DEMO knows these URLs; PYTH-BACKUP regenerates them at 14:00 dress
 * rehearsal.
 */
export default async function CachedSurface({
  params,
}: {
  params: Promise<{ slug: string; surface: string }>;
}) {
  const { slug, surface } = await params;
  if (surface !== "outcome-brief" && surface !== "counterfactual-brief") {
    notFound();
  }
  const brief = await loadBrief(slug);
  if (!brief) notFound();
  return (
    <>
      <ClassicNav />
      <main>
        <div className="mx-auto max-w-[952px] px-8 pt-8">
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-ember)]">
            Cached · served without live DB or LLM dependency
          </div>
        </div>
        <Brief brief={brief} />
      </main>
    </>
  );
}
