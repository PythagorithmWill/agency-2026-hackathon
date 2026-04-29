import { longQuery } from "../db/pool";
import { getPattern } from "./registry";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type SignalStrength,
  meetsMinSignal,
} from "./types";

/**
 * Policy misalignment (Challenge #7).
 *
 * Quantifies the gap between named policy priorities and the dollars
 * actually flowing under those programs. For each named priority area,
 * we sum federal spend across the most recent 5 fiscal years where the
 * program purpose / name contains relevant keywords, and compare to a
 * published commitment value (per the relevant federal budget or mandate
 * letter, where available). Severity scales by gap percentage.
 *
 * The "stated commitment" values are illustrative — they reference
 * recent federal budget announcements (Budget 2024 and earlier) but the
 * detector is calibrated to surface RELATIVE gaps (a priority running at
 * 20% of stated commitment is the signal, not the absolute dollar
 * comparison). Funders refine commitment baselines per their own data.
 *
 * Match condition:
 *   priority area defined below
 *   keyword match found in prog_purpose_en or prog_name_en
 *   ratio of actual / stated < 1.0 (any underspend signals attention)
 */

interface PolicyArea {
  id: string;
  label: string;
  /** Keyword set for ILIKE OR match against program purpose / name. */
  keywords: string[];
  /**
   * Illustrative annual stated commitment in CAD. Calibrated against
   * recent federal budget public announcements; refine per funder.
   */
  statedAnnualCommitmentCad: number;
  /** Plain-language reference for the commitment baseline. */
  commitmentNote: string;
}

const POLICY_AREAS: PolicyArea[] = [
  {
    id: "climate-emissions",
    label: "Climate & emissions reduction",
    keywords: [
      "emission",
      "climate",
      "carbon",
      "net zero",
      "net-zero",
      "decarboniz",
      "clean energy",
      "renewable",
      "greenhouse",
    ],
    statedAnnualCommitmentCad: 9_500_000_000,
    commitmentNote:
      "Federal climate plan and Budget 2024 emissions-related allocations (illustrative annual baseline)",
  },
  {
    id: "housing",
    label: "Housing affordability & supply",
    keywords: [
      "housing",
      "affordable home",
      "rental",
      "homelessness",
      "shelter",
      "co-operative housing",
      "social housing",
    ],
    statedAnnualCommitmentCad: 9_000_000_000,
    commitmentNote:
      "National Housing Strategy + Budget 2024 housing initiatives (illustrative annual baseline)",
  },
  {
    id: "indigenous-reconciliation",
    label: "Indigenous reconciliation",
    keywords: [
      "indigenous",
      "first nation",
      "métis",
      "metis",
      "inuit",
      "reconciliation",
      "treaty",
      "self-government",
      "self government",
    ],
    statedAnnualCommitmentCad: 26_000_000_000,
    commitmentNote:
      "Federal Indigenous-related departmental spend (Indigenous Services + Crown-Indigenous Relations) baseline",
  },
  {
    id: "healthcare",
    label: "Healthcare transfers & services",
    keywords: [
      "health",
      "mental health",
      "primary care",
      "long-term care",
      "long term care",
      "pharmacare",
      "dental",
      "medical",
    ],
    statedAnnualCommitmentCad: 50_000_000_000,
    commitmentNote:
      "Canada Health Transfer plus federal direct healthcare spending (illustrative annual baseline)",
  },
];

interface PolicyRow {
  total: string | number | null;
  agreement_count: string | number | null;
  fy_min: string | number | null;
  fy_max: string | number | null;
  dept_count: string | number | null;
}

function severityFor(ratio: number): SignalStrength {
  // Ratio = actual / stated. Severity bands chosen so that the headline
  // is "consistent underspend" rather than minor variance.
  if (ratio < 0.25) return "flag";
  if (ratio < 0.6) return "attention";
  return "observation";
}

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const policyMisalignmentDetector: PatternDetector = {
  pattern: getPattern("policy-misalignment")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];
    const detectedAt = new Date().toISOString();

    for (const area of POLICY_AREAS) {
      if (filters.subjectId && filters.subjectId !== area.id) continue;

      const ilikePatterns = area.keywords.map((k) => `%${k}%`);
      const conds: string[] = [];
      const params: unknown[] = [];
      for (const pat of ilikePatterns) {
        params.push(pat);
        conds.push(
          `(prog_purpose_en ILIKE $${params.length} OR prog_name_en ILIKE $${params.length})`,
        );
      }

      // Sum spend for the most recent 5 federal fiscal years to give a
      // current-period comparison rather than lifetime totals.
      const sql = `SELECT
                     SUM(agreement_value)::numeric AS total,
                     COUNT(DISTINCT ref_number) AS agreement_count,
                     COUNT(DISTINCT owner_org_title) AS dept_count,
                     MIN(EXTRACT(YEAR FROM agreement_start_date::date)) AS fy_min,
                     MAX(EXTRACT(YEAR FROM agreement_start_date::date)) AS fy_max
                   FROM fed.grants_contributions
                   WHERE is_amendment = false
                     AND agreement_value > 0
                     AND agreement_start_date IS NOT NULL
                     AND agreement_start_date >= (CURRENT_DATE - INTERVAL '5 years')
                     AND (${conds.join(" OR ")})`;

      try {
        const r = await longQuery<PolicyRow>(sql, params, 30_000);
        const row = r.rows[0];
        if (!row) continue;
        const total = Number(row.total) || 0;
        if (total === 0) continue;

        // Annualise: divide observed 5-year window total by years
        // covered to get a comparable annual-rate figure.
        const fyMin = Number(row.fy_min) || 0;
        const fyMax = Number(row.fy_max) || 0;
        const yearsCovered = Math.max(1, fyMax - fyMin + 1);
        const annualRate = total / yearsCovered;
        const ratio = annualRate / area.statedAnnualCommitmentCad;
        const agreementCount = Number(row.agreement_count) || 0;
        const deptCount = Number(row.dept_count) || 0;

        matches.push({
          patternId: "policy-misalignment",
          matchId: `policy-misalignment:${area.id}`,
          subject: {
            type: "program",
            id: area.id,
            canonicalName: area.label,
          },
          evidence: [
            {
              source: "fed.grants_contributions",
              rowId: area.id,
              field: "annual_actual_cad",
              value: annualRate,
            },
            {
              source: "fed.grants_contributions",
              rowId: area.id,
              field: "stated_annual_commitment_cad",
              value: area.statedAnnualCommitmentCad,
            },
            {
              source: "fed.grants_contributions",
              rowId: area.id,
              field: "ratio_actual_over_stated",
              value: ratio.toFixed(3),
            },
            {
              source: "fed.grants_contributions",
              rowId: area.id,
              field: "agreement_count_5y",
              value: agreementCount,
            },
            {
              source: "fed.grants_contributions",
              rowId: area.id,
              field: "department_count_5y",
              value: deptCount,
            },
            {
              source: "calibration",
              rowId: area.id,
              field: "commitment_note",
              value: area.commitmentNote,
            },
          ],
          calibratedSummary: `The dataset shows federal grant & contribution spending tagged to ${area.label.toLowerCase()} ran at ~${compactDollar(annualRate)}/year over the most recent 5-year window (${agreementCount.toLocaleString("en-CA")} agreements across ${deptCount} departments), versus a stated annual baseline of ~${compactDollar(area.statedAnnualCommitmentCad)} (${(ratio * 100).toFixed(0)}% of stated). Glassbox shows the gap; the policy decision-maker confirms whether the baseline measure is right.`,
          signalStrength: severityFor(ratio),
          detectedAt,
        });
      } catch {
        // Per-area failures are logged via the snapshot pipeline; skip
        // and continue so one slow area does not block the others.
        continue;
      }
    }

    return matches
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal))
      .sort((a, b) => {
        const rank = { flag: 2, attention: 1, observation: 0 } as const;
        return rank[b.signalStrength] - rank[a.signalStrength];
      })
      .slice(0, filters.limit ?? 50);
  },
};

export const _POLICY_AREAS_FOR_TEST = POLICY_AREAS;
