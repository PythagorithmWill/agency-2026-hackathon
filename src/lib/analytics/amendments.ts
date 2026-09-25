import type { AmendmentTrajectory, RiskFlag } from "../types/spending";

/**
 * Pure-math amendment-chain analytics. Given an ordered sequence of
 * amendments (oldest → newest), compute the trajectory, total growth,
 * and any risk flags (amendment_growth, amendment_purpose_drift).
 *
 * The DB-touching helper that fetches the chain lives in
 * `src/lib/evaluate/retrieval.ts` (`loadAmendmentChain`).
 */

export interface AmendmentInput {
  amendmentNumber: number;
  date: string | null;
  agreementValue: number;
  description: string | null;
}

const GROWTH_FLAG_THRESHOLD = 2.0; // 200% of initial → flag

export function buildTrajectory(
  recordId: string,
  amendments: ReadonlyArray<AmendmentInput>,
  recipientName: string = "Unknown recipient",
): AmendmentTrajectory {
  if (amendments.length === 0) {
    return {
      recordId,
      initial: { value: 0, date: null },
      current: { value: 0, date: null },
      amendments: [],
      totalGrowth: 0,
      totalGrowthPercent: 0,
      flags: [],
    };
  }

  const sorted = [...amendments].sort((a, b) => a.amendmentNumber - b.amendmentNumber);
  const initial = sorted[0];
  const current = sorted[sorted.length - 1];

  const trajectory = sorted.map((a, i) => ({
    amendmentNumber: a.amendmentNumber,
    value: a.agreementValue,
    date: a.date,
    delta: i === 0 ? 0 : a.agreementValue - sorted[i - 1].agreementValue,
    description: a.description,
  }));

  const totalGrowth = current.agreementValue - initial.agreementValue;
  const totalGrowthPercent =
    initial.agreementValue > 0
      ? totalGrowth / initial.agreementValue
      : 0;

  const flags: RiskFlag[] = [];
  if (totalGrowthPercent >= GROWTH_FLAG_THRESHOLD) {
    flags.push({
      flagId: `amendment_growth:${recordId}`,
      flagType: "amendment_growth",
      severity:
        totalGrowthPercent >= 5
          ? "flag"
          : totalGrowthPercent >= 3
            ? "attention"
            : "observation",
      subject: {
        entityId: recordId,
        canonicalName: recipientName,
        entityType: "recipient",
      },
      evidence: [
        {
          source: "fed.grants_contributions",
          rowId: recordId,
          field: "amendment_chain",
          value: `${initial.agreementValue} → ${current.agreementValue}`,
        },
      ],
      calibratedSummary: calibratedAmendmentSummary({
        recordId,
        initialValue: initial.agreementValue,
        currentValue: current.agreementValue,
        totalGrowthPercent,
        amendmentCount: sorted.length,
      }),
      upstreamLinks: [],
      downstreamLinks: [],
      detectedAt: new Date().toISOString(),
    });
  }

  // amendment_purpose_drift — Jaccard similarity of initial and current
  // descriptions as a keyword proxy. Token overlap ≤ 0.30 → drift flag.
  if (sorted.length >= 3 && initial.description && current.description) {
    const sim = jaccard(initial.description, current.description);
    if (sim < 0.3) {
      flags.push({
        flagId: `amendment_purpose_drift:${recordId}`,
        flagType: "amendment_purpose_drift",
        severity: sim < 0.15 ? "attention" : "observation",
        subject: {
          entityId: recordId,
          canonicalName: recipientName,
          entityType: "recipient",
        },
        evidence: [
          {
            source: "fed.grants_contributions",
            rowId: recordId,
            field: "description_similarity",
            value: sim.toFixed(2),
          },
        ],
        calibratedSummary: `The dataset shows ${sorted.length} amendments to record ${recordId}. Keyword overlap between the initial and current description is ${(sim * 100).toFixed(0)}%; pattern consistent with amendment-purpose drift.`,
        upstreamLinks: [],
        downstreamLinks: [],
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return {
    recordId,
    initial: { value: initial.agreementValue, date: initial.date },
    current: { value: current.agreementValue, date: current.date },
    amendments: trajectory,
    totalGrowth,
    totalGrowthPercent,
    flags,
  };
}

function calibratedAmendmentSummary(input: {
  recordId: string;
  initialValue: number;
  currentValue: number;
  totalGrowthPercent: number;
  amendmentCount: number;
}): string {
  const dollar = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
  return `The dataset shows ${input.amendmentCount} amendments to record ${input.recordId}, growing from ${dollar.format(input.initialValue)} initial commitment to ${dollar.format(input.currentValue)} current commitment (+${(input.totalGrowthPercent * 100).toFixed(0)}%).`;
}

/** Keyword tokens used by the drift measure: lower-cased words of 4+ chars. */
export function keywordTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  );
}

/**
 * Observations behind a drift score: which keywords were only in the
 * initial description, only in the current one, and how many were shared.
 * This is what a reader needs to judge the flag; the score alone is not.
 */
export function keywordDiff(a: string, b: string, limit = 14): {
  onlyInitial: string[];
  onlyCurrent: string[];
  shared: number;
} {
  const sa = keywordTokens(a);
  const sb = keywordTokens(b);
  const onlyInitial = [...sa].filter((t) => !sb.has(t)).sort();
  const onlyCurrent = [...sb].filter((t) => !sa.has(t)).sort();
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  return { onlyInitial: onlyInitial.slice(0, limit), onlyCurrent: onlyCurrent.slice(0, limit), shared };
}

/** Token-set Jaccard similarity for two strings. */
export function jaccard(a: string, b: string): number {
  const sa = keywordTokens(a);
  const sb = keywordTokens(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
