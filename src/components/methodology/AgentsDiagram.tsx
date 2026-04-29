"use client";

import { motion, useReducedMotion } from "framer-motion";

const AGENTS = [
  { id: "PYTH-LEAD", role: "Orchestrator" },
  { id: "PYTH-DATA", role: "S4 source-linked" },
  { id: "PYTH-SYN", role: "S3 semantic" },
  { id: "PYTH-FE", role: "S2 procedural" },
  { id: "PYTH-GOV", role: "S3 semantic" },
];

/**
 * Five-column orchestration micro-graphic. PYTH-LEAD at top centre,
 * branching down to the four working agents. Lines draw on viewport
 * entry; nodes fade in with stagger.
 */
export function AgentsDiagram() {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  // Simple geometry: viewBox 800 × 220
  // Lead at (400, 40), four leaves at (130, 180), (310, 180), (490, 180), (670, 180)
  const lead = { x: 400, y: 40 };
  const leaves = [
    { x: 100, y: 175 },
    { x: 285, y: 175 },
    { x: 470, y: 175 },
    { x: 655, y: 175 },
  ];

  return (
    <motion.div
      className="mt-8"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={
        reduce
          ? undefined
          : { hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }
      }
    >
      <svg
        viewBox="0 0 800 220"
        className="w-full h-auto"
        aria-hidden="true"
      >
        {/* Connecting lines from lead to each leaf */}
        {leaves.map((leaf, i) => {
          const len = Math.hypot(leaf.x - lead.x, leaf.y - lead.y) + 80;
          return (
            <motion.line
              key={i}
              x1={lead.x}
              y1={lead.y + 14}
              x2={leaf.x}
              y2={leaf.y - 14}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
              strokeLinecap="round"
              initial={{ strokeDasharray: len, strokeDashoffset: len }}
              whileInView={reduce ? undefined : { strokeDashoffset: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.7, ease }}
            />
          );
        })}

        {/* Lead node */}
        <motion.g
          variants={
            reduce
              ? undefined
              : {
                  hidden: { opacity: 0, y: -4 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
                }
          }
        >
          <rect
            x={lead.x - 70}
            y={lead.y - 14}
            width="140"
            height="28"
            rx="14"
            fill="var(--color-bg-elev-2)"
            stroke="var(--color-accent)"
            strokeWidth="1"
          />
          <text
            x={lead.x}
            y={lead.y + 4}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="var(--color-accent)"
            letterSpacing="0.08em"
          >
            PYTH-LEAD
          </text>
        </motion.g>

        {/* Leaf nodes */}
        {leaves.map((leaf, i) => {
          const a = AGENTS[i + 1];
          return (
            <motion.g
              key={a.id}
              variants={
                reduce
                  ? undefined
                  : {
                      hidden: { opacity: 0, y: 4 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
                    }
              }
            >
              <rect
                x={leaf.x - 70}
                y={leaf.y - 14}
                width="140"
                height="28"
                rx="14"
                fill="var(--color-bg-elev-1)"
                stroke="var(--color-border-strong)"
                strokeWidth="1"
              />
              <text
                x={leaf.x}
                y={leaf.y + 4}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="11"
                fill="var(--color-fg)"
                letterSpacing="0.08em"
              >
                {a.id}
              </text>
              <text
                x={leaf.x}
                y={leaf.y + 32}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="10"
                fill="var(--color-fg-subtle)"
                letterSpacing="0.06em"
              >
                {a.role}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </motion.div>
  );
}
