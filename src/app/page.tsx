import { Hero } from "@/components/home/Hero";
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
      <FollowTheMoneySection />
      <ExplainerCards />
      <ThreeChecksViz />
      <AuditTrailSection />
      <ByTheNumbers />
      <MethodologyPreview />
      <HomepageFooter />
    </main>
  );
}
