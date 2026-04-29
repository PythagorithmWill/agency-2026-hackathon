"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type SearchMode = "search" | "evaluate";

/**
 * The homepage centerpiece. 88px tall, bg-elev-1, 16px corner radius.
 * Magnifying glass at left, body-lg input, accent submit button right.
 * Pill toggles below switch between Search and Evaluate-a-draft.
 *
 * Submit behavior:
 *   - Search → /search?q=<encoded>
 *   - Evaluate → /evaluate?draft=<encoded> (form pre-fills the textarea)
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
  const [, start] = useTransition();

  const onSubmit = () => {
    const q = query.trim();
    if (!q) return;
    if (mode === "search") {
      start(() => {
        router.push((`/search?q=${encodeURIComponent(q)}`) as never);
      });
    } else {
      const params = new URLSearchParams({ draft: q });
      start(() => {
        router.push((`/evaluate?${params.toString()}`) as never);
      });
    }
  };

  return (
    <div className="mx-auto max-w-[720px] w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="search-input-wrap rounded-[16px] bg-[var(--color-bg-elev-1)] border border-[var(--color-border-strong)]"
      >
        <div className="flex items-stretch h-[88px] px-6 gap-4">
          <span className="flex items-center text-[var(--color-fg-muted)]">
            {mode === "search" ? <SearchGlyph /> : <ClipboardGlyph />}
          </span>
          {mode === "search" ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search by topic, recipient, program, or paste a draft excerpt"
              className="flex-1 bg-transparent border-0 outline-none text-[22px] leading-[28px] placeholder:italic placeholder:text-[var(--color-fg-subtle)]"
            />
          ) : (
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste your draft solicitation. Working title, scope, recipient — whatever you have."
              className="flex-1 bg-transparent border-0 outline-none text-[18px] leading-[26px] placeholder:italic placeholder:text-[var(--color-fg-subtle)] resize-none py-5 max-h-[180px]"
              rows={3}
            />
          )}
          <button
            type="submit"
            disabled={!query.trim()}
            className="group self-center h-14 px-6 rounded-[8px] bg-[var(--color-accent)] text-[var(--color-bg)] text-[14px] font-semibold tracking-[0.01em] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {mode === "search" ? "Search" : "Evaluate"}
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </button>
        </div>
      </form>
      <div className="mt-6 flex justify-center gap-3">
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
        "px-4 py-1.5 rounded-full font-[var(--font-mono)] text-[12px] uppercase tracking-[0.08em] transition-all duration-200 " +
        (active
          ? "bg-[var(--color-bg-elev-2)] text-[var(--color-accent)] border border-[var(--color-accent)]/40"
          : "bg-transparent text-[var(--color-fg-subtle)] border border-[var(--color-border)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]")
      }
    >
      {label}
    </button>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

function ClipboardGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M5 6h14v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Z" />
      <path d="M9 12h6M9 15h4" />
    </svg>
  );
}
