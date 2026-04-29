import { notFound } from "next/navigation";
import { ClassicNav } from "@/components/ClassicNav";
import { Brief } from "@/components/Brief";
import { loadBrief } from "@/lib/briefs";

export default async function OutcomeBriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brief = await loadBrief(slug);
  if (!brief || brief.briefType !== "outcome") notFound();
  return (
    <>
      <ClassicNav />
      <main>
        <Brief brief={brief} />
      </main>
    </>
  );
}
