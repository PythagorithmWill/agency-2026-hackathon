import { ClassicNav } from "@/components/ClassicNav";
import { GlassBox } from "@/components/GlassBox";
import { getCachedFindings } from "@/lib/findings";

export default async function ClassicHome() {
  const findings = await getCachedFindings();
  return (
    <>
      <ClassicNav />
      <main className="mx-auto max-w-[1440px] px-8 py-12">
        <GlassBox findings={findings} />
      </main>
    </>
  );
}
