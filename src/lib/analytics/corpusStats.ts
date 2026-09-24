import { loadSnapshot } from "./snapshot";
import type { CorpusFacts } from "./queries";

/**
 * Corpus figures for site copy. Sourced from the analytics snapshot's
 * `overview.corpus` block (written by scripts/build-snapshot.ts), so every
 * data refresh + snapshot rebuild updates the homepage, tour, explainer and
 * search copy together. The fallback constants are the 2026-04-21 export.
 */
const FALLBACK: CorpusFacts = {
  fedRows: 1_275_521,
  abGrantsRows: 1_986_676,
  abContractsRows: 67_079,
  goldenRecords: 851_300,
  noDescriptionSpendFed: 71_500_000_000,
};

export interface CorpusStats extends CorpusFacts {
  abRows: number;
  asOf: string | null;
  fmt: {
    fedRows: string;
    abRows: string;
    goldenRecords: string;
    noDescriptionSpendFed: string;
  };
}

export function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return n.toLocaleString("en-CA");
}
export function fmtMoneyB(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n).toLocaleString("en-CA")}`;
}

export async function getCorpusStats(): Promise<CorpusStats> {
  const snap = await loadSnapshot().catch(() => null);
  const facts = snap?.overview?.corpus ?? FALLBACK;
  const abRows = facts.abGrantsRows + facts.abContractsRows;
  return {
    ...facts,
    abRows,
    asOf: snap?.generatedAt?.slice(0, 10) ?? null,
    fmt: {
      fedRows: fmtCount(facts.fedRows),
      abRows: fmtCount(abRows),
      goldenRecords: fmtCount(facts.goldenRecords),
      noDescriptionSpendFed: fmtMoneyB(facts.noDescriptionSpendFed),
    },
  };
}
