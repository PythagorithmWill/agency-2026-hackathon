"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type SearchMode = "search" | "evaluate";

/**
 * The centerpiece input. Switches between Search (single-line, magnifier
 * affordance) and Evaluate-a-draft (textarea with form fields below).
 *
 * Wired to /api/search for search mode and /api/draft/evaluate for
 * evaluate mode. Both routes return calibrated payloads; errors fall back
 * to the static cached path on the result page.
 */
export function SearchInput({
  initialMode = "search",
  initialQuery = "",
}: {
  initialMode?: SearchMode;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [working, start] = useTransition();

  const onSubmit = () => {
    if (mode === "search") {
      const q = query.trim();
      if (!q) return;
      start(() => {
        router.push((`/search?q=${encodeURIComponent(q)}`) as never);
      });
    } else {
      // Evaluate mode — push to the form page with the draft pre-filled
      const params = new URLSearchParams({ draft: query });
      start(() => {
        router.push((`/evaluate?${params.toString()}`) as never);
      });
    }
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="search-input-wrap rounded-[12px] bg-[var(--color-bg-elev-1)] border border-[var(--color-border-strong)]"
      >
        <div className="flex items-stretch gap-3 px-5 py-4">
          <span className="flex items-center text-[var(--color-fg-subtle)]">
            {mode === "search" ? <SearchGlyph /> : <ClipboardGlyph />}
          </span>
          {mode === "search" ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search by topic, recipient, program, or paste a draft excerpt"
              className="flex-1 bg-transparent border-0 outline-none text-[var(--text-body-lg)] placeholder:italic placeholder:text-[var(--color-fg-muted)]"
            />
          ) : (
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={6}
              placeholder="Paste your draft solicitation. Working title, program, recipient, scope — whatever you have."
              className="flex-1 bg-transparent border-0 outline-none text-[var(--text-body-lg)] placeholder:italic placeholder:text-[var(--color-fg-muted)] resize-none min-h-[140px]"
            />
          )}
          <button
            type="submit"
            disabled={!query.trim() || working}
            className="self-stretch px-5 rounded-[8px] bg-[var(--color-accent)] text-[var(--color-bg)] text-[var(--text-body-sm)] font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {mode === "search" ? "Search →" : "Evaluate →"}
          </button>
        </div>
      </form>
      <div className="mt-3 flex justify-center gap-2">
        <Pill
          active={mode === "search"}
          onClick={() => setMode("search")}
          label="Search"
        />
        <Pill
          active={mode === "evaluate"}
          onClick={() => setMode("evaluate")}
          label="Evaluate a draft"
        />
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1 rounded-full font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] transition-colors " +
        (active
          ? "bg-[var(--color-bg-elev-2)] text-[var(--color-accent)] border border-[var(--color-accent)]/30"
          : "bg-transparent text-[var(--color-fg-subtle)] border border-[var(--color-border)] hover:text-[var(--color-fg)]")
      }
    >
      {label}
    </button>
  );
}

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

function ClipboardGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M5 6h14v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Z" />
      <path d="M9 12h6M9 15h4" />
    </svg>
  );
}
