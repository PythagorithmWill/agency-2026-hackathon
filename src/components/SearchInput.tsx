"use client";

import { useState } from "react";
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
 *
 * The submit path uses router.push first, with a window.location.assign
 * fallback so the navigation always lands even if a transition or
 * hydration race swallows the router call.
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

  const onSubmit = () => {
    const q = query.trim();
    if (!q) return;
    const target =
      mode === "search"
        ? `/search?q=${encodeURIComponent(q)}`
        : `/evaluate?draft=${encodeURIComponent(q)}`;
    try {
      router.push(target as never);
    } catch {
      // ignore — fall through to hard nav
    }
    // Hard fallback: if the soft client-side push doesn't land in 250ms,
    // force a real navigation. This unblocks any rare hydration/transition
    // edge case so the search button is never a dead end.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.pathname + window.location.search !== target) {
          window.location.assign(target);
        }
      }, 250);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] w-full" data-tour-id="tour-search">
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              autoFocus
              placeholder="Search by topic, recipient, program, or paste a draft excerpt"
              className="flex-1 bg-transparent border-0 outline-none text-[22px] leading-[28px] placeholder:italic placeholder:text-[var(--color-fg-subtle)]"
            />
          ) : (
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl-Enter submits a draft from the textarea so plain
                // Enter still inserts newlines (drafts are multi-line).
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Paste your draft solicitation. Working title, scope, recipient — whatever you have. (⌘/Ctrl+Enter to submit)"
              className="flex-1 bg-transparent border-0 outline-none text-[18px] leading-[26px] placeholder:italic placeholder:text-[var(--color-fg-subtle)] resize-none py-5 max-h-[180px]"
              rows={3}
            />
          )}
          <button
            type="submit"
            disabled={!query.trim()}
            onClick={(e) => {
              // Defensive: explicit click handler so the navigation fires
              // even if the surrounding form's onSubmit doesn't bubble for
              // any reason (Turbopack hydration edge cases, etc).
              e.preventDefault();
              onSubmit();
            }}
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
