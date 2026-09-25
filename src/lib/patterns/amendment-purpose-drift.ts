import { longQuery } from "../db/pool";
import { jaccard, keywordDiff } from "../analytics/amendments";
import { getPattern } from "./registry";
import { isNullLikeId } from "./identity";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type Severity,
  meetsMinSignal,
  asIso,
  fiscalYearOf,
} from "./types";
import { evidenceStrength, benignNoteFor, severityToSignalStrength } from "./strength";
import { dollar, num } from "./format";

/**
 * Amendment-purpose-drift detector. Scans federal agreements with ≥3
 * amendments where the Jaccard token overlap between the initial and
 * current description is below 0.30. Pure observation — Glassbox makes
 * no causal claim about why the descriptions diverged.
 *
 * SQL pulls per-agreement first/last description pairs in a single
 * window query; Jaccard is computed in JS. Agreements are keyed by the
 * F-1 key (ref_number, COALESCE(bn, legal_name, _id)) — ref_number alone
 * collides across unrelated recipients (KNOWN-DATA-ISSUES F-1), which
 * would pair one recipient's original with another's amendment.
 *
 * signal = 1 − similarity (higher = more drift).
 */

interface DriftRow {
  ref_number: string | null;
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_province: string | null;
  owner_org_title: string | null;
  initial_description: string | null;
  current_description: string | null;
  amendment_count: string | number | null;
  initial_value: string | number | null;
  current_value: string | number | null;
  current_start_date: string | Date | null;
  ref_collision: boolean | null;
}

const SIMILARITY_FLOOR = 0.3;

function severityFor(sim: number): Severity {
  if (sim < 0.05) return "critical";
  if (sim < 0.1) return "high";
  if (sim < 0.15) return "medium";
  return "low";
}

export const amendmentPurposeDriftDetector: PatternDetector = {
  pattern: getPattern("amendment-purpose-drift")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND i.ref_number = $${params.length}`;
    }
    // Jaccard is computed in JS, so pull a wider candidate set than the
    // requested limit (most chains with ≥3 amendments keep their text).
    params.push(Math.min(Math.max(limit * 4, 200), 200_000));

    const r = await longQuery<DriftRow>(
      `WITH ranked AS (
         SELECT
           ref_number,
           COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
           recipient_legal_name, recipient_business_number, recipient_province,
           owner_org_title,
           description_en,
           agreement_value,
           agreement_start_date,
           NULLIF(amendment_number, '')::int AS amend_n,
           _id,
           ROW_NUMBER() OVER (
             PARTITION BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)
             ORDER BY NULLIF(amendment_number, '')::int ASC NULLS FIRST, _id ASC
           ) AS rn_first,
           ROW_NUMBER() OVER (
             PARTITION BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)
             ORDER BY NULLIF(amendment_number, '')::int DESC NULLS LAST, _id DESC
           ) AS rn_last,
           COUNT(*) OVER (
             PARTITION BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)
           ) AS amendment_count,
           MIN(COALESCE(recipient_business_number, recipient_legal_name, _id::text)) OVER (PARTITION BY ref_number)
             <> MAX(COALESCE(recipient_business_number, recipient_legal_name, _id::text)) OVER (PARTITION BY ref_number)
             AS ref_collision
         FROM fed.grants_contributions
         WHERE ref_number IS NOT NULL
           AND description_en IS NOT NULL
           AND length(description_en) >= 60
           AND agreement_value > 0
       ),
       initial AS (
         SELECT ref_number, agreement_key, recipient_legal_name, recipient_business_number,
                recipient_province, owner_org_title,
                description_en AS initial_description,
                agreement_value AS initial_value,
                amendment_count, ref_collision
           FROM ranked
          WHERE rn_first = 1 AND amendment_count >= 3
       ),
       current AS (
         SELECT ref_number, agreement_key,
                description_en AS current_description,
                agreement_value AS current_value,
                agreement_start_date AS current_start_date
           FROM ranked
          WHERE rn_last = 1
       )
       SELECT i.ref_number, i.recipient_legal_name, i.recipient_business_number, i.recipient_province,
              i.owner_org_title, i.initial_description, c.current_description,
              i.amendment_count, i.initial_value, c.current_value, c.current_start_date, i.ref_collision
         FROM initial i
         JOIN current c USING (ref_number, agreement_key)
        WHERE c.current_description IS NOT NULL
          AND length(c.current_description) >= 60
          AND c.current_description <> i.initial_description
          ${extra}
        ORDER BY i.amendment_count DESC
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 90_000,
    );

    const matches: PatternMatch[] = [];
    for (const row of r.rows) {
      const initial = row.initial_description ?? "";
      const current = row.current_description ?? "";
      if (!initial || !current) continue;
      const sim = jaccard(initial, current);
      if (sim >= SIMILARITY_FLOOR) continue;
      const ref = row.ref_number ?? "";
      const rawBn = row.recipient_business_number;
      const flags = {
        refCollision: Boolean(row.ref_collision),
        placeholderBn: rawBn != null && isNullLikeId(rawBn),
        missingBn: rawBn == null,
      };
      const severity = severityFor(sim);
      const startIso = asIso(row.current_start_date);
      const diff = keywordDiff(initial, current);
      const excerpt = (s: string, n = 700) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
      const m: PatternMatch = {
        patternId: "amendment-purpose-drift",
        matchId: `amendment-purpose-drift:${ref}`,
        subject: { type: "agreement", id: ref, canonicalName: row.recipient_legal_name ?? "Unknown recipient" },
        evidence: [
          { source: "fed.grants_contributions", rowId: ref, field: "description_similarity", value: sim.toFixed(3) },
          { source: "fed.grants_contributions", rowId: ref, field: "amendment_count", value: num(row.amendment_count) },
          { source: "fed.grants_contributions", rowId: ref, field: "value_change", value: `${dollar.format(num(row.initial_value))} → ${dollar.format(num(row.current_value))}` },
          { source: "fed.grants_contributions", rowId: ref, field: "department", value: row.owner_org_title },
          // Observations that led to the flag — rendered by MatchObservations.
          { source: "fed.grants_contributions", rowId: ref, field: "initial_description", value: excerpt(initial) },
          { source: "fed.grants_contributions", rowId: ref, field: "current_description", value: excerpt(current) },
          { source: "fed.grants_contributions", rowId: ref, field: "keywords_only_in_initial", value: diff.onlyInitial.join(", ") || "—" },
          { source: "fed.grants_contributions", rowId: ref, field: "keywords_only_in_current", value: diff.onlyCurrent.join(", ") || "—" },
          { source: "fed.grants_contributions", rowId: ref, field: "keywords_shared", value: diff.shared },
          { source: "fed.grants_contributions", rowId: ref, field: "current_start_date", value: startIso ? startIso.slice(0, 10) : null },
        ],
        calibratedSummary: `The dataset shows ${row.amendment_count} amendments to record ${ref} (${row.recipient_legal_name ?? "—"}, ${row.owner_org_title ?? "—"}). Keyword overlap between the initial and current description is ${(sim * 100).toFixed(0)}%; pattern consistent with amendment-purpose drift.`,
        severity,
        signalStrength: severityToSignalStrength(severity),
        signal: Number((1 - sim).toFixed(3)),
        evidenceStrength: evidenceStrength({ margin: (SIMILARITY_FLOOR - sim) / SIMILARITY_FLOOR, flags }),
        benignNote: benignNoteFor("amendment-purpose-drift", { name: row.recipient_legal_name, flags, always: ["DESCRIPTION_REWRITE"] }),
        department: row.owner_org_title ?? null,
        province: row.recipient_province ?? null,
        fiscalYear: fiscalYearOf(startIso),
        detectedAt: new Date().toISOString(),
      };
      if (meetsMinSignal(m.signalStrength, filters.minSignal)) matches.push(m);
      if (matches.length >= limit) break;
    }
    return matches;
  },
};

export const _SIMILARITY_FLOOR_FOR_TEST = SIMILARITY_FLOOR;
