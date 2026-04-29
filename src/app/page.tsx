import { Nav } from "@/components/Nav";
import { GlassBox } from "@/components/GlassBox";
import { getCachedFindings } from "@/lib/findings";

export default async function Home() {
  const findings = await getCachedFindings();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1440px] px-8 py-12">
        <GlassBox findings={findings} />
      </main>
    </>
  );
}
