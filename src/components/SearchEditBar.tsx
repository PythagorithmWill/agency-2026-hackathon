"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Query echo + edit affordance on /search. Click the echoed query to
 * open a small input that re-submits.
 */
export function SearchEditBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [working, start] = useTransition();

  const submit = () => {
    const value = q.trim();
    if (!value) return;
    start(() => {
      router.push((`/search?q=${encodeURIComponent(value)}`) as never);
    });
    setOpen(false);
  };

  if (open) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="search-input-wrap inline-flex items-center gap-3 rounded-[8px] bg-[var(--color-bg-elev-1)] border border-[var(--color-border-strong)] px-4 py-2 max-w-[640px]"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          onBlur={() => setOpen(false)}
          className="flex-1 bg-transparent border-0 outline-none text-[var(--text-body)] placeholder:italic placeholder:text-[var(--color-fg-subtle)] min-w-[280px]"
        />
        <button
          type="submit"
          disabled={!q.trim() || working}
          className="text-[var(--color-accent)] text-[var(--text-body-sm)] hover:opacity-90 disabled:opacity-30"
        >
          Update →
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group inline-flex items-baseline gap-3 text-left"
    >
      <span className="text-[var(--text-body-lg)] text-[var(--color-fg-muted)]">
        Showing results for:
      </span>
      <span className="text-[var(--text-body-lg)] text-[var(--color-fg)] italic group-hover:underline-offset-4 group-hover:underline decoration-[var(--color-border-strong)]">
        &ldquo;{initialQuery}&rdquo;
      </span>
      <span className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)]">
        edit
      </span>
    </button>
  );
}
