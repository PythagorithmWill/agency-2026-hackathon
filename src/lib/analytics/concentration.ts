import type { ConcentrationReport } from "../types/spending";

/**
 * Pure-math concentration analytics. Operates on an array of
 * recipient totals — no DB access here so the module is unit-testable.
 *
 * - HHI (Herfindahl-Hirschman Index): sum of squared market shares ×
 *   10000. 0..10000 scale. <1500 unconcentrated, 1500..2500 moderate,
 *   >2500 concentrated.
 * - Gini coefficient: standard definition over sorted recipients.
 * - Top-10 share: sum of top-10 shares.
 * - Decile breakdown: cumulative share by decile.
 */

export interface RecipientTotal {
  recipient: string;
  bn: string | null;
  total: number;
  agreementCount: number;
}

export function computeConcentration(
  rows: ReadonlyArray<RecipientTotal>,
): ConcentrationReport {
  const positives = rows.filter((r) => r.total > 0);
  const totalSpend = positives.reduce((s, r) => s + r.total, 0);
  const recipientCount = positives.length;
  const agreementCount = positives.reduce((s, r) => s + r.agreementCount, 0);

  if (totalSpend <= 0 || recipientCount === 0) {
    return {
      totalSpend: 0,
      recipientCount: 0,
      agreementCount: 0,
      hhi: 0,
      gini: 0,
      median: 0,
      mean: 0,
      top10: [],
      decileBreakdown: [],
    };
  }

  // Sort descending by total
  const sorted = [...positives].sort((a, b) => b.total - a.total);

  const hhi = sorted.reduce((s, r) => {
    const share = r.total / totalSpend;
    return s + share * share;
  }, 0) * 10_000;

  const top10 = sorted.slice(0, 10).map((r) => ({
    recipient: r.recipient,
    bn: r.bn,
    total: r.total,
    share: r.total / totalSpend,
    agreementCount: r.agreementCount,
  }));

  const totals = sorted.map((r) => r.total);
  const median = totals.length % 2 === 1
    ? totals[(totals.length - 1) / 2]
    : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;
  const mean = totalSpend / recipientCount;

  // Gini: 1 - 2 * area under Lorenz curve. Compute via the discrete formula
  // for sorted values: G = (1 / (n × mean)) × sum_{i} ((2i - n - 1) × x_i)
  // where x_i is the i-th sorted-ascending value (1-indexed).
  const ascending = [...totals].sort((a, b) => a - b);
  let giniNumerator = 0;
  for (let i = 0; i < ascending.length; i++) {
    giniNumerator += (2 * (i + 1) - ascending.length - 1) * ascending[i];
  }
  const gini = giniNumerator / (ascending.length * mean) / ascending.length;

  // Decile breakdown — share of total spend captured by each decile
  // (decile 1 = bottom 10%, decile 10 = top 10%).
  const decileBreakdown: Array<{ decile: number; share: number }> = [];
  for (let d = 1; d <= 10; d++) {
    const lo = Math.floor(((d - 1) / 10) * ascending.length);
    const hi = Math.floor((d / 10) * ascending.length);
    const slice = ascending.slice(lo, hi);
    const decileTotal = slice.reduce((s, v) => s + v, 0);
    decileBreakdown.push({ decile: d, share: decileTotal / totalSpend });
  }

  return {
    totalSpend,
    recipientCount,
    agreementCount,
    hhi,
    gini,
    median,
    mean,
    top10,
    decileBreakdown,
  };
}

/**
 * Calibrated-language one-line observation summarising a concentration
 * report. Lives here so every consumer renders the same calibrated text.
 */
export function describeConcentration(report: ConcentrationReport): string {
  if (report.recipientCount === 0) {
    return "The dataset returned no records matching the filters.";
  }
  const dollar = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
  const top3Share = report.top10.slice(0, 3).reduce((s, r) => s + r.share, 0);
  const concentrationLabel =
    report.hhi >= 2500
      ? "concentrated"
      : report.hhi >= 1500
        ? "moderately concentrated"
        : "unconcentrated";
  return `The dataset shows ${report.recipientCount.toLocaleString("en-CA")} recipients receiving ${dollar.format(report.totalSpend)} across ${report.agreementCount.toLocaleString("en-CA")} agreements. Top three recipients account for ${(top3Share * 100).toFixed(0)}% of total volume; HHI ${report.hhi.toFixed(0)} (${concentrationLabel}); Gini ${report.gini.toFixed(2)}.`;
}
