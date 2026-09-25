import { Hero } from "@/components/home/Hero";
import { ScrollReveal } from "@/components/home/ScrollReveal";
import { IntroSection } from "@/components/home/IntroSection";
import { FollowTheMoneySection } from "@/components/home/FollowTheMoneySection";
import { ExplainerCards } from "@/components/home/ExplainerCards";
import { ThreeChecksViz } from "@/components/home/ThreeChecksViz";
import { AuditTrailSection } from "@/components/home/AuditTrailSection";
import { ByTheNumbers } from "@/components/home/ByTheNumbers";
import { MethodologyPreview } from "@/components/home/MethodologyPreview";
import { HomepageFooter } from "@/components/home/HomepageFooter";
import { getCorpusStats, fmtCount } from "@/lib/analytics/corpusStats";
import { loadPatternCounts } from "@/lib/patterns/store";
import { PATTERNS } from "@/lib/patterns/registry";

export default async function Home() {
  const corpus = await getCorpusStats();
  const counts = await loadPatternCounts().catch(() => ({} as Record<string, number>));
  const introStats = {
    fedRows: corpus.fmt.fedRows,
    abRows: corpus.fmt.abRows,
    goldenRecords: corpus.fmt.goldenRecords,
    fundingLoops: fmtCount(counts["funding-loops"] ?? 0),
    patterns: String(PATTERNS.length),
    detectorsLive: String(Object.values(counts).filter((n) => n > 0).length),
  };
  return (
    <main className="min-h-screen">
      <Hero />
      <ScrollReveal>
        <IntroSection stats={introStats} />
      </ScrollReveal>
      <ScrollReveal>
        <FollowTheMoneySection />
      </ScrollReveal>
      <ScrollReveal>
        <ExplainerCards fedRows={corpus.fmt.fedRows} abRows={corpus.fmt.abRows} />
      </ScrollReveal>
      <ScrollReveal>
        <ThreeChecksViz />
      </ScrollReveal>
      <ScrollReveal>
        <AuditTrailSection />
      </ScrollReveal>
      <ScrollReveal>
        <ByTheNumbers
          noDescriptionSpendFed={corpus.noDescriptionSpendFed}
          fedRows={corpus.fedRows}
          abRows={corpus.abRows}
        />
      </ScrollReveal>
      <ScrollReveal>
        <MethodologyPreview />
      </ScrollReveal>
      <HomepageFooter />
    </main>
  );
}
