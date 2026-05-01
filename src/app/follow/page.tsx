import Link from "next/link";
import { PATTERNS } from "@/lib/patterns/registry";
import { PatternCard } from "@/components/follow/PatternCard";

export const metadata = { title: "Follow the money — Glassbox" };

export default function FollowLanding() {
  const traceCount = PATTERNS.filter((p) => p.attribution === "TRACE").length;

  return (
    <main className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative border-b border-[var(--color-border-strong)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6 pt-20 sm:pt-32 pb-12 sm:pb-20 text-center">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · pattern catalog
          </div>
          <h1 className="mt-6 text-[clamp(48px,11vw,160px)] leading-[0.92] tracking-[-0.045em] font-medium">
            Follow the money<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-8 mx-auto max-w-[820px] text-[clamp(20px,2vw,26px)] italic text-[var(--color-fg-muted)] leading-[1.4]">
            Twelve named patterns across federal and Alberta provincial spending. Each surfaces
            specific records that match. Each output cites every source row.
          </p>
          <p className="mt-6 font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            {traceCount} TRACE-derived <span className="opacity-50">·</span> {PATTERNS.length - traceCount} Glassbox-native
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PATTERNS.map((p, i) => (
            <PatternCard key={p.id} pattern={p} index={i} />
          ))}
        </div>
      </section>

      {/* Attribution */}
      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-[15px] tracking-tight">TRACE attribution</h3>
            <p className="mt-2 text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
              Six patterns are derived from Alberta's TRACE program (Targeted Review of Alberta's
              Contracts and Expenditures), Ministry of Technology and Innovation. Glassbox
              extends those pattern definitions to the federal corpus and surfaces them in a
              public-facing UI.
            </p>
            <Link
              href={"/trace" as never}
              className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Read the data lineage →
            </Link>
          </div>
          <div>
            <h3 className="text-[15px] tracking-tight">Calibrated language</h3>
            <p className="mt-2 text-[14px] text-[var(--color-fg-muted)] leading-[1.55]">
              Glassbox surfaces correlations and observations, not causal claims. Every match
              carries an audit token, an evidence array citing source rows, and language reviewed
              against the calibration sweep (no &ldquo;fraud&rdquo;, no &ldquo;clearly shows&rdquo;,
              no &ldquo;should have&rdquo;).
            </p>
            <Link
              href={"/methodology" as never}
              className="mt-3 inline-block font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Read the methodology →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
