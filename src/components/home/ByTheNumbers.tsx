"use client";

import { CountUp } from "../motion/CountUp";

const STATS = [
  {
    label: "Federal spend with no public description",
    value: 71.5,
    format: (n: number) => `$${n.toFixed(1)}B`,
  },
  {
    label: "Federal grants & contributions records",
    value: 1.27,
    format: (n: number) => `${n.toFixed(2)}M`,
  },
  {
    label: "Alberta provincial records",
    value: 47,
    format: (n: number) => `${n.toFixed(0)}K`,
  },
  {
    label: "Validation tiers per output",
    value: 4,
    format: (n: number) => n.toFixed(0),
  },
] as const;

/**
 * Stats strip. CSS-keyframe reveal — was framer-motion whileInView,
 * which crashed React's removeChild path on route navigation.
 */
export function ByTheNumbers() {
  return (
    <section className="border-y border-[var(--color-border-strong)] py-16 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{ animation: `glassbox-fade-up 0.5s ease-out ${i * 0.08}s both` }}
            >
              <div className="font-[var(--font-mono)] text-[clamp(40px,4.5vw,56px)] leading-none font-medium text-[var(--color-fg)]">
                <CountUp to={s.value} durationMs={1500} format={s.format} startOnView />
              </div>
              <div className="mt-4 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)] max-w-[220px]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
