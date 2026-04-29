import type { AIAEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * The AIA Register panel — 10 federal AI systems with their published
 * Algorithmic Impact Assessment scores. The visual structure mirrors the
 * Proof badge: impact chip, system name, department, mitigation indicator.
 * The architectural argument lands without any pitch.
 */
export function AIARegisterPanel({
  entries,
  className,
}: {
  entries: ReadonlyArray<AIAEntry>;
  className?: string;
}) {
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
          GC AIA Register
        </div>
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)]">
          {entries.length} systems
        </div>
      </div>
      <p className="mt-2 text-[var(--text-small)] text-[var(--color-muted)]">
        Federal AI systems published under TBS Directive on Automated
        Decision-Making. Impact scored 1–4; mitigation gated against impact.
      </p>
      <ul className="mt-4 divide-y divide-[var(--color-rule)]">
        {entries.map((aia) => {
          const passed = mitigationPassed(aia);
          return (
            <li key={aia.aiaId} className="py-3">
              <div className="flex items-baseline gap-3">
                <ImpactChip level={aia.impactLevel} />
                <a
                  href={aia.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-[var(--text-small)] hover:underline"
                >
                  {aia.systemName}
                </a>
                <span
                  aria-label={passed ? "mitigation passed" : "mitigation gap"}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    passed
                      ? "bg-[var(--color-sage)]"
                      : "bg-[var(--color-ember)]",
                  )}
                />
              </div>
              <div className="ml-[44px] mt-1 font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)]">
                {aia.department}
                {aia.publishedDate && ` · ${aia.publishedDate.slice(0, 10)}`}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ImpactChip({ level }: { level: 1 | 2 | 3 | 4 }) {
  const palette: Record<1 | 2 | 3 | 4, string> = {
    1: "border-[var(--color-rule)] text-[var(--color-muted)]",
    2: "border-[var(--color-rule)] text-[var(--color-paper)]",
    3: "border-[var(--color-ember)] text-[var(--color-ember)]",
    4: "border-[var(--color-ember)] text-[var(--color-ember)]",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 w-9 items-center justify-center rounded-[4px] border",
        "font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)]",
        palette[level],
      )}
      aria-label={`Impact level ${level}`}
    >
      I-{level}
    </span>
  );
}

/** Mitigation gating thresholds per the TBS Directive impact level. */
function mitigationPassed(aia: AIAEntry): boolean {
  // Per the TBS Directive: required mitigation rises with impact level.
  // The thresholds below are the policy defaults; agencies can document
  // exceptions in the AIA itself.
  const required: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 25, 3: 50, 4: 75 };
  return aia.mitigationScore >= required[aia.impactLevel];
}
