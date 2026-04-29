"use client";

import { motion, useReducedMotion } from "framer-motion";
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

export function ByTheNumbers() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <section className="border-y border-[var(--color-border-strong)] py-24">
      <div className="mx-auto max-w-[1200px] px-6 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.08, duration: 0.5, ease }}
            >
              <div className="font-[var(--font-mono)] text-[clamp(40px,4.5vw,56px)] leading-none font-medium text-[var(--color-fg)]">
                <CountUp to={s.value} durationMs={1500} format={s.format} startOnView />
              </div>
              <div className="mt-4 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)] max-w-[220px]">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
