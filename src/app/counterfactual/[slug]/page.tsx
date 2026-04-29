import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Brief } from "@/components/Brief";
import { loadBrief } from "@/lib/briefs";

export default async function CounterfactualBriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brief = await loadBrief(slug);
  if (!brief || brief.briefType !== "counterfactual") notFound();
  return (
    <>
      <Nav />
      <main>
        <Brief brief={brief} />
      </main>
    </>
  );
}
