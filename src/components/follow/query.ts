/**
 * Query-string helpers for /follow/[slug]. All filters travel as URL
 * params so every view is a shareable, server-rendered link — no client
 * state. Keys are deliberately short (`dept`, `prov`, `fy`, `strength`,
 * `page`, `severity`) to keep URLs readable.
 */

export const FOLLOW_PAGE_SIZE = 50;

export interface FollowQuery {
  page?: number;
  dept?: string;
  prov?: string;
  fy?: number;
  strength?: number;
  severity?: string;
}

export function followHref(slug: string, q: FollowQuery): string {
  const sp = new URLSearchParams();
  if (q.dept) sp.set("dept", q.dept);
  if (q.prov) sp.set("prov", q.prov);
  if (q.fy != null) sp.set("fy", String(q.fy));
  if (q.strength != null && q.strength > 0) sp.set("strength", q.strength.toFixed(2));
  if (q.severity) sp.set("severity", q.severity);
  if (q.page != null && q.page > 1) sp.set("page", String(q.page));
  const qs = sp.toString();
  return qs ? `/follow/${slug}?${qs}` : `/follow/${slug}`;
}

/** Positive integer page number; anything else (0, -3, "abc", 9e99) → 1. */
export function parsePage(raw: string | undefined): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= 1_000_000 ? n : 1;
}

/** Strength floor in [0, 1]; out-of-range or unparsable → undefined. */
export function parseStrength(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return undefined;
  return n;
}

/** Fiscal year as a 4-digit integer; anything else → undefined. */
export function parseFy(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : undefined;
}

/** Trim + length-cap a free-text filter; empty → undefined. */
export function parseText(raw: string | undefined, max = 200): string | undefined {
  if (raw == null) return undefined;
  const s = raw.trim().slice(0, max);
  return s.length > 0 ? s : undefined;
}
