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

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <ScrollReveal>
        <IntroSection />
      </ScrollReveal>
      <ScrollReveal>
        <FollowTheMoneySection />
      </ScrollReveal>
      <ScrollReveal>
        <ExplainerCards />
      </ScrollReveal>
      <ScrollReveal>
        <ThreeChecksViz />
      </ScrollReveal>
      <ScrollReveal>
        <AuditTrailSection />
      </ScrollReveal>
      <ScrollReveal>
        <ByTheNumbers />
      </ScrollReveal>
      <ScrollReveal>
        <MethodologyPreview />
      </ScrollReveal>
      <HomepageFooter />
    </main>
  );
}
