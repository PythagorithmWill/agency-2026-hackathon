"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Row {
  tier: string;
  pythagorithm: string;
  aia: string;
}

export function AnimatedAiaTable({ rows }: { rows: Row[] }) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <div className="mt-6 -mx-4 sm:mx-0 overflow-x-auto px-4 sm:px-0">
    <motion.table
      className="w-full min-w-[640px] sm:min-w-0 border-collapse text-[14px]"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={
        reduce
          ? undefined
          : { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
      }
    >
      <thead>
        <motion.tr
          variants={
            reduce
              ? undefined
              : {
                  hidden: { opacity: 0, y: 4 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
                }
          }
          className="border-b border-[var(--color-border)]"
        >
          <Th>Tier</Th>
          <Th>Audit token (Glassbox)</Th>
          <Th>Federal AIA</Th>
        </motion.tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <motion.tr
            key={r.tier}
            variants={
              reduce
                ? undefined
                : {
                    hidden: { opacity: 0, y: 4 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
                  }
            }
            className="relative border-b border-[var(--color-border)]"
          >
            <td className="relative py-3 pl-3 font-[var(--font-mono)] text-[13px] text-[var(--color-fg-muted)]">
              <span
                aria-hidden
                className="absolute left-0 top-3 bottom-3 w-[2px] bg-[var(--color-accent)]"
              />
              {r.tier}
            </td>
            <td className="py-3 px-3 text-[var(--color-fg)] leading-[1.4]">
              {r.pythagorithm}
            </td>
            <td className="py-3 text-[var(--color-fg)] leading-[1.4]">{r.aia}</td>
          </motion.tr>
        ))}
      </tbody>
    </motion.table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-3 text-left font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] font-normal">
      {children}
    </th>
  );
}
