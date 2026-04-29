import Link from "next/link";
import { tracePatterns } from "@/lib/patterns/registry";
import { PatternCard } from "../follow/PatternCard";

/**
 * Homepage "Follow the money" section. Shows the six TRACE-derived
 * patterns in a 3×2 grid. The full 12-pattern view lives at /follow.
 */
export function FollowTheMoneySection() {
  const patterns = tracePatterns().slice(0, 6);

  return (
    <section className="relative py-24 md:py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="max-w-[760px]">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox patterns
          </div>
          <h2 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            Follow the money<span className="text-[var(--color-accent)]">.</span>
          </h2>
          <p className="mt-5 text-[var(--text-body-lg)] italic text-[var(--color-fg-muted)] leading-[1.4]">
            Pick a pattern. Glassbox surfaces every record matching it, in calibrated language,
            with full citation.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.map((p, i) => (
            <PatternCard key={p.id} pattern={p} index={i} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <Link
            href={"/follow" as never}
            className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            + 6 more patterns →
          </Link>
          <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            Six TRACE-derived patterns shown · twelve total at /follow
          </div>
        </div>
      </div>
    </section>
  );
}
