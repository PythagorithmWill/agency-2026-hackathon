import Link from "next/link";
import type { FollowQuery } from "./query";

/**
 * Compact GET-form filter bar for /follow/[slug]. Server-rendered: the
 * browser submits a plain query string, the page re-renders. Option
 * lists come from loadPatternFilters(); when the store is serving the
 * static snapshot there are no filters, and the page hides this bar.
 */
export function MatchFilterBar({
  slug,
  current,
  departments,
  provinces,
  fyRange,
}: {
  slug: string;
  current: FollowQuery;
  departments: string[];
  provinces: string[];
  fyRange: { min: number; max: number } | null;
}) {
  const fyOptions: number[] = [];
  if (fyRange) {
    for (let y = fyRange.max; y >= fyRange.min; y--) fyOptions.push(y);
  }
  const anyActive =
    !!current.dept || !!current.prov || current.fy != null || (current.strength ?? 0) > 0;
  const label =
    "font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]";
  const select =
    "mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] px-2.5 py-1.5 text-[13px] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <form
      method="get"
      action={`/follow/${slug}`}
      aria-label="Filter matches"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 flex flex-wrap items-end gap-3"
    >
      {departments.length > 0 && (
        <label className="min-w-[200px] flex-1">
          <span className={label}>Department</span>
          <select name="dept" defaultValue={current.dept ?? ""} className={select}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      {provinces.length > 0 && (
        <label className="min-w-[120px]">
          <span className={label}>Province</span>
          <select name="prov" defaultValue={current.prov ?? ""} className={select}>
            <option value="">All</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}
      {fyOptions.length > 0 && (
        <label className="min-w-[120px]">
          <span className={label}>Fiscal year from</span>
          <select name="fy" defaultValue={current.fy != null ? String(current.fy) : ""} className={select}>
            <option value="">Any</option>
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="min-w-[140px]">
        <span className={label}>Min. evidence strength</span>
        <select
          name="strength"
          defaultValue={current.strength != null ? current.strength.toFixed(2) : ""}
          className={select}
        >
          <option value="">Any</option>
          <option value="0.40">≥ 0.40 · moderate</option>
          <option value="0.70">≥ 0.70 · strong</option>
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          Apply
        </button>
        {anyActive && (
          <Link
            href={`/follow/${slug}` as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Clear ×
          </Link>
        )}
      </div>
    </form>
  );
}
