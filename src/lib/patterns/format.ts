/** Shared number formatting for calibrated summaries. */
export const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function compactDollar(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return dollar.format(v);
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SQL fragment: the corpus as-of date — the latest agreement_start_date
 * that is not in the future (publishers file forward-dated agreements).
 * Every rolling window in a detector is anchored here, never on a fixed
 * date and never on the wall clock alone.
 */
export const CORPUS_AS_OF_SQL = `(SELECT MAX(agreement_start_date) FROM fed.grants_contributions WHERE agreement_start_date <= CURRENT_DATE)`;
