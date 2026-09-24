import Link from "next/link";
import { followHref, type FollowQuery, FOLLOW_PAGE_SIZE } from "./query";

export function MatchPagination({
  slug,
  query,
  page,
  total,
}: {
  slug: string;
  query: FollowQuery;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / FOLLOW_PAGE_SIZE));
  if (pages <= 1) return null;
  const from = (page - 1) * FOLLOW_PAGE_SIZE + 1;
  const to = Math.min(total, page * FOLLOW_PAGE_SIZE);
  const linkCls =
    "font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]";
  const disabledCls =
    "font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] opacity-50";
  return (
    <nav
      aria-label="Match pages"
      className="flex flex-wrap items-baseline justify-between gap-4 border-t border-[var(--color-border)] pt-5"
    >
      {page > 1 ? (
        <Link href={followHref(slug, { ...query, page: page - 1 }) as never} className={linkCls}>
          ← Previous
        </Link>
      ) : (
        <span className={disabledCls}>← Previous</span>
      )}
      <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] tabular-nums">
        {from.toLocaleString("en-CA")}–{to.toLocaleString("en-CA")} of{" "}
        {total.toLocaleString("en-CA")} · page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={followHref(slug, { ...query, page: page + 1 }) as never} className={linkCls}>
          Next →
        </Link>
      ) : (
        <span className={disabledCls}>Next →</span>
      )}
    </nav>
  );
}
