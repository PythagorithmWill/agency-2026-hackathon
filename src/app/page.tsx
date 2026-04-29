import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { ExplainerCards } from "@/components/home/ExplainerCards";
import { ThreeChecksViz } from "@/components/home/ThreeChecksViz";
import { AuditTrailSection } from "@/components/home/AuditTrailSection";
import { ByTheNumbers } from "@/components/home/ByTheNumbers";
import { MethodologyPreview } from "@/components/home/MethodologyPreview";
import { HomepageFooter } from "@/components/home/HomepageFooter";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="absolute top-0 left-0 right-0 z-20 mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <span className="text-[var(--color-fg)]">Pythagorithm</span>
        <nav className="flex gap-6">
          <Link href={"/methodology" as never} className="hover:text-[var(--color-fg)]">
            Methodology
          </Link>
          <Link href={"/evaluate" as never} className="hover:text-[var(--color-fg)]">
            Evaluate
          </Link>
        </nav>
      </header>

      <Hero />
      <ExplainerCards />
      <ThreeChecksViz />
      <AuditTrailSection />
      <ByTheNumbers />
      <MethodologyPreview />
      <HomepageFooter />
    </main>
  );
}
