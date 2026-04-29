"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Generic whileInView reveal for methodology sections. 16px translateY,
 *  0.6s cubic-bezier; respects prefers-reduced-motion. */
export function RevealSection({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
