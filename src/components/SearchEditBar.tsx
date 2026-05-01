"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Query echo + edit affordance on /search. Always renders an editable
 * input so the user has somewhere to type whether or not they arrived
 * with a query in the URL. The previous "click to open" pattern had
 * two bugs: it showed `Showing results for: ""` when the URL had no
 * ?q= param, and the input's onBlur closed the form before the submit
 * button's click event fired (blur-before-click race).
 */
export function SearchEditBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [working, start] = useTransition();

  const submit = () => {
    const value = q.trim();
    if (!value) return;
    start(() => {
      router.push((`/search?q=${encodeURIComponent(value)}`) as never);
    });
  };

  return (
    <div>
      {initialQuery ? (
        <div className="mb-2 text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
          Showing results for:{" "}
          <span className="text-[var(--color-fg)] italic">
            &ldquo;{initialQuery}&rdquo;
          </span>
        </div>
      ) : (
        <div className="mb-2 text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
          Search the federal &amp; Alberta provincial corpus.
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="search-input-wrap flex items-center gap-2 sm:gap-3 rounded-[10px] bg-[var(--color-bg-elev-1)] border border-[var(--color-border-strong)] px-3 sm:px-4 py-3 max-w-[680px]"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            initialQuery
              ? "Update your search…"
              : "Try “indigenous broadband”, “artificial intelligence”, “housing”…"
          }
          autoFocus={!initialQuery}
          className="min-w-0 flex-1 bg-transparent border-0 outline-none text-[var(--text-body)] placeholder:italic placeholder:text-[var(--color-fg-subtle)]"
        />
        <button
          type="submit"
          disabled={!q.trim() || working || q.trim() === initialQuery}
          className="shrink-0 font-[var(--font-mono)] text-[11px] sm:text-[12px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:opacity-90 disabled:opacity-30"
        >
          {working ? "Searching…" : initialQuery ? "Update →" : "Search →"}
        </button>
      </form>
    </div>
  );
}
