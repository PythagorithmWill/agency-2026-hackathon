/**
 * Three explainer cards under the homepage hero. Side-by-side at desktop,
 * single column at mobile. Hover lifts to elevation 2 with border-strong.
 */
export function ExplainerCards() {
  return (
    <div className="mx-auto max-w-[1200px] grid grid-cols-1 md:grid-cols-3 gap-6 px-6">
      <Card
        title="Search the corpus"
        body="Query 1.27M federal records and 47K Alberta records by topic, recipient, or program. Hybrid retrieval — keyword and semantic — every result is auditable to its source row."
        glyph={<MagnifierGlyph />}
      />
      <Card
        title="Evaluate a draft"
        body="Paste a solicitation draft to surface duplication risk, recipient concentration, and calibrated-language issues before publishing — not after audit."
        glyph={<ClipboardCheckGlyph />}
      />
      <Card
        title="Audit-ready trail"
        body="Every result, every score, every recommendation carries a Pythagorithm Proof token. Downloadable JSON. Independently verifiable."
        glyph={<ShieldCheckGlyph />}
      />
    </div>
  );
}

function Card({
  title,
  body,
  glyph,
}: {
  title: string;
  body: string;
  glyph: React.ReactNode;
}) {
  return (
    <article className="group relative rounded-[24px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-8 transition-colors hover:bg-[var(--color-bg-elev-2)]">
      <div className="absolute top-6 right-6 text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] transition-colors">
        {glyph}
      </div>
      <h2 className="text-[var(--text-heading)] tracking-[var(--tracking-heading)] font-medium">
        {title}
      </h2>
      <p className="mt-4 text-[var(--text-body)] text-[var(--color-fg-muted)] leading-[1.55]">
        {body}
      </p>
    </article>
  );
}

function MagnifierGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}
function ClipboardCheckGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M5 6h14v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Z" />
      <path d="M9 14l2.5 2.5L16 12" />
    </svg>
  );
}
function ShieldCheckGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v7c0 4.418-3.582 7-8 8-4.418-1-8-3.582-8-8V6l8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
