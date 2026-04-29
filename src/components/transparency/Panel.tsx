import type { ReactNode } from "react";

interface Props {
  title: string;
  caption?: string;
  href?: string;
  children: ReactNode;
  span?: 1 | 2 | 3;
}

/**
 * Panel — the standard six-grid dashboard tile. Uses --color-bg-elev-1
 * for surface, hairline border, generous internal padding. `span`
 * controls grid-column-span (1/2/3 of the 3-col responsive grid).
 */
export function Panel({ title, caption, href, children, span = 1 }: Props) {
  const colspan = span === 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "";
  return (
    <section
      className={
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 " +
        colspan
      }
    >
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] tracking-tight text-[var(--color-fg)]">{title}</h3>
        {href && (
          <a
            href={href}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            View →
          </a>
        )}
      </header>
      {caption && (
        <p className="mb-4 text-[13px] text-[var(--color-fg-muted)]">{caption}</p>
      )}
      {children}
    </section>
  );
}
