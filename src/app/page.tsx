import { HeroIllustration } from "@/components/HeroIllustration";
import { SearchInput } from "@/components/SearchInput";
import { ExplainerCards } from "@/components/ExplainerCards";
import Link from "next/link";

export default function Home() {
  return (
    <main className="atmosphere-mesh min-h-screen">
      <header className="mx-auto max-w-[1440px] px-8 pt-8 flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <span>Pythagorithm</span>
        <nav className="flex gap-6">
          <Link href={"/methodology" as never} className="hover:text-[var(--color-fg)]">
            Methodology
          </Link>
          <Link href={"/evaluate" as never} className="hover:text-[var(--color-fg)]">
            Evaluate
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-[1080px] px-6 pt-32 md:pt-48 text-center">
        <h1
          className="text-[var(--text-display-xl)] leading-[80px] tracking-[var(--tracking-display)] font-semibold"
          style={{
            opacity: 0,
            animation: "hero-headline 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          Before the money goes out.
        </h1>
        <p
          className="mt-6 mx-auto max-w-[720px] text-[var(--text-body-lg)] leading-[28px] text-[var(--color-fg-muted)]"
          style={{
            opacity: 0,
            animation: "hero-headline 600ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards",
          }}
        >
          Search and evaluate federal contracts and grants before they're
          posted publicly. Surface duplication, concentration, and
          calibration issues during drafting — not after audit.
        </p>

        <div className="mt-16">
          <HeroIllustration />
        </div>

        <div
          className="mt-24"
          style={{
            opacity: 0,
            transform: "scale(0.97)",
            animation: "hero-input 400ms cubic-bezier(0.16, 1, 0.3, 1) 200ms forwards",
          }}
        >
          <SearchInput />
        </div>
      </section>

      <section className="mt-32 pb-32">
        <ExplainerCards />
      </section>

      <footer className="mx-auto max-w-[1440px] px-8 py-12 border-t border-[var(--color-border)] flex justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <span>Pythagorithm · Agency 2026, Ottawa</span>
        <span>v0.3 · build {process.env.BUILD_COMMIT?.slice(0, 7) ?? "dev"}</span>
      </footer>

      <style>{`
        @keyframes hero-headline {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-input {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
