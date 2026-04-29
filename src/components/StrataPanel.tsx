"use client";

import { cn } from "@/lib/cn";

const STRATA = [
  { id: "S1", label: "Episodic", agent: "PYTH-LEAD", radius: 96 },
  { id: "S2", label: "Procedural", agent: "PYTH-FE / OPS / DEMO", radius: 76 },
  { id: "S3", label: "Semantic", agent: "PYTH-SYN / GOV", radius: 56 },
  { id: "S4", label: "Source-linked", agent: "PYTH-DB / RES", radius: 36 },
  { id: "S5", label: "Archival", agent: "(delegated)", radius: 16 },
];

/**
 * The Strata Panel — concentric arcs labeled with the stratum and the agent
 * inhabiting it. Inactive arcs are 1px rule at 30% opacity. Active stratum
 * (passed via `activeId`) is full paper opacity. HIGH-risk activity flips it
 * to ember. NO AMBIENT MOTION — this only changes when something happens.
 */
export function StrataPanel({
  activeId = null,
  riskLevel = "low",
  className,
}: {
  activeId?: string | null;
  riskLevel?: "high" | "low";
  className?: string;
}) {
  const cx = 110;
  const cy = 110;
  return (
    <div
      className={cn(
        "border border-[var(--color-rule)] bg-[var(--color-vellum)]",
        "p-6 rounded-[8px]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          Strata
        </div>
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          {activeId ?? "idle"}
        </div>
      </div>
      <svg
        viewBox="0 0 220 220"
        width="100%"
        height="auto"
        className="mt-4"
        aria-label="Manifold strata diagram"
      >
        {STRATA.map((s) => {
          const isActive = s.id === activeId;
          const stroke = isActive
            ? riskLevel === "high"
              ? "var(--color-ember)"
              : "var(--color-paper)"
            : "var(--color-rule)";
          return (
            <circle
              key={s.id}
              cx={cx}
              cy={cy}
              r={s.radius}
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              opacity={isActive ? 1 : 0.45}
            />
          );
        })}
        {/* Tiny labels at the right of each arc */}
        {STRATA.map((s) => (
          <text
            key={s.id}
            x={cx + s.radius + 6}
            y={cy + 3}
            className="font-[var(--font-mono)]"
            fontSize="9"
            fill="var(--color-muted)"
          >
            {s.id}
          </text>
        ))}
      </svg>
      <ul className="mt-4 space-y-2 font-[var(--font-mono)] text-[var(--text-micro)]">
        {STRATA.map((s) => (
          <li
            key={s.id}
            className={cn(
              "flex items-baseline justify-between",
              s.id === activeId
                ? riskLevel === "high"
                  ? "text-[var(--color-ember)]"
                  : "text-[var(--color-paper)]"
                : "text-[var(--color-muted)]",
            )}
          >
            <span>
              {s.id} · {s.label}
            </span>
            <span className="text-[var(--color-muted)]">{s.agent}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
