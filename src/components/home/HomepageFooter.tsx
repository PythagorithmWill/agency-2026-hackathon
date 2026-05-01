import Link from "next/link";
import { GlassboxWordmark } from "../brand/GlassboxMark";
import { DataSourceStatusPill } from "../DataSourceStatusPill";

const isProd = process.env.NODE_ENV === "production";

export function HomepageFooter() {
  return (
    <footer className="border-t border-[var(--color-border-strong)] py-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12">
          <div>
            <div className="flex items-center">
              <GlassboxWordmark size={27} className="text-[var(--color-fg)]" />
            </div>
            <div className="mt-4 text-[14px] leading-[20px] text-[var(--color-fg-muted)] max-w-[260px]">
              See through the spend.
            </div>
            <div className="mt-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              Built for Agency 2026 Hackathon · Ottawa · April 29 2026
            </div>
          </div>
          <div>
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Product
            </div>
            <ul className="mt-3 space-y-2 text-[14px]">
              <FooterLink href="/methodology">Methodology</FooterLink>
              <FooterLink href="/evaluate">Evaluate a draft</FooterLink>
              <FooterLink href="/search?q=federal+broadband">Search corpus</FooterLink>
              <FooterLink href="/api/health">/api/health</FooterLink>
            </ul>
          </div>
          <div>
            <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Build
            </div>
            <div className="mt-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
              v0.3 · Open source MIT
            </div>
            {!isProd && (
              <div className="mt-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                {process.env.BUILD_COMMIT?.slice(0, 7) ?? "dev"}
              </div>
            )}
            <div className="mt-4">
              <DataSourceStatusPill />
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--color-border)] flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
            <span className="normal-case tracking-normal italic text-[var(--color-fg-muted)]">
              Glassbox — observations from public records. They are not findings of misconduct.
            </span>
          </div>
          <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] mt-2">
            Built on the Pythagorithm Proof Methodology v1.0
          </div>
          <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)] mt-1 normal-case tracking-normal italic">
            Follow the money — Alberta TRACE methodology, federal corpus, open source.
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href as never}
        className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
      >
        {children}
      </Link>
    </li>
  );
}
