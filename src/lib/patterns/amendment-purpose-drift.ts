import { longQuery } from "../db/pool";
import { jaccard } from "../analytics/amendments";
import { getPattern } from "./registry";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type SignalStrength,
  meetsMinSignal,
} from "./types";

/**
 * Amendment-purpose-drift detector. Scans federal agreements with ≥3
 * amendments where the Jaccard token overlap between the initial and
 * current description is below 0.30. Pure observation — Glassbox makes
 * no causal claim about why the descriptions diverged.
 *
 * SQL pulls per-ref_number first/last description pairs in a single
 * window query; Jaccard is computed in JS.
 */

interface DriftRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  owner_org_title: string | null;
  initial_description: string | null;
  current_description: string | null;
  amendment_count: string | number | null;
  initial_value: string | number | null;
  current_value: string | number | null;
}

const SIMILARITY_FLOOR = 0.3;

function severityFor(sim: number): SignalStrength {
  if (sim < 0.1) return "flag";
  if (sim < 0.15) return "attention";
  return "observation";
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export const amendmentPurposeDriftDetector: PatternDetector = {
  pattern: getPattern("amendment-purpose-drift")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND ref_number = $${params.length}`;
    }
    params.push(limit);

    // Get the first and last (current) description per ref_number from
    // the federal corpus, restricted to chains with ≥3 amendments and
    // both ends present + non-trivially long.
    const r = await longQuery<DriftRow>(
      `WITH ranked AS (
         SELECT
           ref_number,
           recipient_legal_name,
           owner_org_title,
           description_en,
           agreement_value,
           NULLIF(amendment_number, '')::int AS amend_n,
           _id,
           ROW_NUMBER() OVER (
             PARTITION BY ref_number
             ORDER BY NULLIF(amendment_number, '')::int ASC NULLS FIRST, _id ASC
           ) AS rn_first,
           ROW_NUMBER() OVER (
             PARTITION BY ref_number
             ORDER BY NULLIF(amendment_number, '')::int DESC NULLS LAST, _id DESC
           ) AS rn_last,
           COUNT(*) OVER (PARTITION BY ref_number) AS amendment_count
         FROM fed.grants_contributions
         WHERE ref_number IS NOT NULL
           AND description_en IS NOT NULL
           AND length(description_en) >= 60
           AND agreement_value > 0
       ),
       initial AS (
         SELECT ref_number, recipient_legal_name, owner_org_title,
                description_en AS initial_description,
                agreement_value AS initial_value,
                amendment_count
           FROM ranked
          WHERE rn_first = 1 AND amendment_count >= 3
       ),
       current AS (
         SELECT ref_number,
                description_en AS current_description,
                agreement_value AS current_value
           FROM ranked
          WHERE rn_last = 1
       )
       SELECT i.ref_number, i.recipient_legal_name, i.owner_org_title,
              i.initial_description, c.current_description,
              i.amendment_count, i.initial_value, c.current_value
         FROM initial i
         JOIN current c USING (ref_number)
        WHERE c.current_description IS NOT NULL
          AND length(c.current_description) >= 60
          ${extra}
        ORDER BY i.amendment_count DESC
        LIMIT $${params.length}`,
      params,
      60_000,
    );

    const matches: PatternMatch[] = [];
    for (const row of r.rows) {
      const initial = row.initial_description ?? "";
      const current = row.current_description ?? "";
      if (!initial || !current) continue;
      const sim = jaccard(initial, current);
      if (sim >= SIMILARITY_FLOOR) continue;
      const m: PatternMatch = {
        patternId: "amendment-purpose-drift",
        matchId: `amendment-purpose-drift:${row.ref_number}`,
        subject: {
          type: "agreement",
          id: row.ref_number ?? "",
          canonicalName: row.recipient_legal_name ?? "Unknown recipient",
        },
        evidence: [
          {
            source: "fed.grants_contributions",
            rowId: row.ref_number ?? "",
            field: "description_similarity",
            value: sim.toFixed(3),
          },
          {
            source: "fed.grants_contributions",
            rowId: row.ref_number ?? "",
            field: "amendment_count",
            value: Number(row.amendment_count) || 0,
          },
          {
            source: "fed.grants_contributions",
            rowId: row.ref_number ?? "",
            field: "value_change",
            value: `${dollar.format(Number(row.initial_value) || 0)} → ${dollar.format(Number(row.current_value) || 0)}`,
          },
        ],
        calibratedSummary: `The dataset shows ${row.amendment_count} amendments to record ${row.ref_number} (${row.recipient_legal_name ?? "—"}, ${row.owner_org_title ?? "—"}). Keyword overlap between the initial and current description is ${(sim * 100).toFixed(0)}%; pattern consistent with amendment-purpose drift.`,
        signalStrength: severityFor(sim),
        detectedAt: new Date().toISOString(),
      };
      if (meetsMinSignal(m.signalStrength, filters.minSignal)) {
        matches.push(m);
      }
    }
    return matches;
  },
};

export const _SIMILARITY_FLOOR_FOR_TEST = SIMILARITY_FLOOR;
