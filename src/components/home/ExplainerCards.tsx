/**
 * Section B — three explainer cards under the hero. CSS-keyframe reveal
 * with staggered delays. No framer-motion (its whileInView observers
 * raced with route navigation and crashed React's removeChild path).
 */
export function ExplainerCards() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-16 py-20 sm:py-28 md:py-32">
      <div style={{ animation: "glassbox-fade-up 0.6s ease-out both" }}>
        <h2 className="text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-[-0.025em] font-medium">
          What this does.
        </h2>
        <p className="mt-4 italic text-[18px] leading-[28px] text-[var(--color-fg-muted)]">
          Three primary capabilities. One coherent product.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          index={0}
          title="Search the corpus"
          body="Query 1.27M federal records and 2.5M Alberta provincial records by topic, recipient, or program. Hybrid retrieval — keyword and semantic — every result is auditable to its source row."
          glyph={<MagnifierGlyph />}
        />
        <Card
          index={1}
          title="Evaluate a draft"
          body="Paste a solicitation draft to surface duplication risk, recipient concentration, and calibrated-language issues before publishing — not after audit."
          glyph={<ClipboardCheckGlyph />}
        />
        <Card
          index={2}
          title="Audit-ready trail"
          body="Every result, every score, every recommendation carries an audit token. Downloadable JSON. Independently verifiable."
          glyph={<ShieldCheckGlyph />}
        />
      </div>
    </section>
  );
}

function Card({
  title,
  body,
  glyph,
  index,
}: {
  title: string;
  body: string;
  glyph: React.ReactNode;
  index: number;
}) {
  return (
    <article
      style={{ animation: `glassbox-fade-up 0.6s ease-out ${0.15 + index * 0.08}s both` }}
      className="group relative rounded-[24px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-6 sm:p-8 min-h-[260px] sm:min-h-[320px] transition-colors hover:bg-[var(--color-bg-elev-2)] hover:border-[var(--color-border-strong)]"
    >
      <div className="absolute top-7 right-7 text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] transition-colors duration-200">
        {glyph}
      </div>
      <h3 className="text-[22px] leading-[30px] tracking-[-0.01em] font-medium pr-12">
        {title}
      </h3>
      <p className="mt-4 text-[16px] leading-[1.55] text-[var(--color-fg)]">
        {body}
      </p>
    </article>
  );
}

function MagnifierGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}
function ClipboardCheckGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M5 6h14v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Z" />
      <path d="M9 14l2.5 2.5L16 12" />
    </svg>
  );
}
function ShieldCheckGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v7c0 4.418-3.582 7-8 8-4.418-1-8-3.582-8-8V6l8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
