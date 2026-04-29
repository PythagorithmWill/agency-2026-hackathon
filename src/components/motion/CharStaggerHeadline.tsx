"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Character-stagger entrance for a headline. Each character fades in with
 * translateY(12px) → 0, 30ms apart. If `accentLast` is set, the final
 * character renders in `--color-accent` and gets an additional scale
 * 0.8 → 1.0 on entry.
 *
 * Respects prefers-reduced-motion — collapses to instant render.
 */
export function CharStaggerHeadline({
  text,
  accentLast = false,
  className = "",
  staggerMs = 30,
  initialDelayMs = 100,
  charDurationMs = 600,
  as = "h1",
}: {
  text: string;
  accentLast?: boolean;
  className?: string;
  staggerMs?: number;
  initialDelayMs?: number;
  charDurationMs?: number;
  as?: "h1" | "h2" | "h3";
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return wrap(as, className, plainNodes(text, accentLast));
  }

  const chars = Array.from(text);
  const ease = [0.16, 1, 0.3, 1] as const;

  const Tag = motion[as] as typeof motion.h1;

  return (
    <Tag
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerMs / 1000,
            delayChildren: initialDelayMs / 1000,
          },
        },
      }}
      aria-label={text}
    >
      {chars.map((c, i) => {
        const isAccent = accentLast && i === chars.length - 1;
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            className="inline-block"
            style={isAccent ? { color: "var(--color-accent)" } : undefined}
            variants={{
              hidden: { opacity: 0, y: 12, scale: isAccent ? 0.8 : 1 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: charDurationMs / 1000, ease },
              },
            }}
          >
            {c === " " ? " " : c}
          </motion.span>
        );
      })}
    </Tag>
  );
}

function plainNodes(text: string, accentLast: boolean): ReactNode {
  if (!accentLast) return text;
  if (text.length === 0) return text;
  return (
    <>
      {text.slice(0, -1)}
      <span style={{ color: "var(--color-accent)" }}>{text.slice(-1)}</span>
    </>
  );
}

function wrap(
  tag: "h1" | "h2" | "h3",
  className: string,
  children: ReactNode,
): ReactNode {
  if (tag === "h1") return <h1 className={className}>{children}</h1>;
  if (tag === "h2") return <h2 className={className}>{children}</h2>;
  return <h3 className={className}>{children}</h3>;
}
