import { longQuery } from "../db/pool";
import { getPattern, THRESHOLDS } from "./registry";
import {
  type PatternDetector,
  type PatternMatch,
  type PatternFilters,
  type Severity,
  meetsMinSignal,
  asIso,
  fiscalYearOf,
} from "./types";
import { evidenceStrength, benignNoteFor, marginOver, severityToSignalStrength, MIN_GROUP } from "./strength";
import { compactDollar, num, CORPUS_AS_OF_SQL } from "./format";

/**
 * Vendor concentration (Challenge #5). Adapted from the hackathon repo's
 * FED/scripts/advanced/04-recipient-concentration.js HHI calculation;
 * methodology v2.
 *
 * Unit of analysis is the (department, program) pair — department-wide
 * HHI is diluted by hundreds of unrelated programs, whereas a single
 * program dominated by one supplier is the "incumbency replacing
 * competition" signal the challenge describes.
 *
 * Window: rolling 36 months ending at the corpus as-of date
 * (MAX(agreement_start_date) ≤ CURRENT_DATE) — concentration TODAY, not
 * lifetime.
 *
 * Match condition (v2):
 *   program total (original commitments) in the window ≥ $10M   — floor
 *   ≥ 3 distinct recipients in the window (a program with one or two
 *     named recipients is a transfer vehicle, not a market; HHI = 10,000
 *     by construction — those are excluded from both the peer set and
 *     the matches)
 *   HHI = Σ (recipient share × 100)² over recipients in the program
 *   HHI ≥ p90 of program HHIs within the same department            — relative
 *   AND HHI ≥ 1500                                                  — absolute floor
 * Bands (US DOJ merger guidelines): ≥5000 extreme, ≥2500 highly,
 * ≥1500 moderately concentrated.
 */

interface ConcRow {
  department: string | null;
  program: string | null;
  prog_total: string | number | null;
  recipient_count: string | number | null;
  hhi: string | number | null;
  dept_p90: string | number | null;
  dept_peer_count: string | number | null;
  corpus_as_of: string | Date | null;
  top1_name: string | null;
  top1_value: string | number | null;
  top2_name: string | null;
  top2_value: string | number | null;
  top3_name: string | null;
  top3_value: string | number | null;
}

const PROGRAM_FLOOR = THRESHOLDS.VENDOR_PROGRAM_FLOOR;
const HHI_FLOOR = THRESHOLDS.VENDOR_HHI_FLOOR;
const MIN_RECIPIENTS = THRESHOLDS.VENDOR_MIN_RECIPIENTS;
const WINDOW_MONTHS = THRESHOLDS.ROLLING_WINDOW_MONTHS;

function severityFor(hhi: number): Severity {
  if (hhi >= 7500) return "critical";
  if (hhi >= 5000) return "high";
  if (hhi >= 2500) return "medium";
  return "low";
}

export const vendorConcentrationDetector: PatternDetector = {
  pattern: getPattern("vendor-concentration")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [PROGRAM_FLOOR, HHI_FLOOR, THRESHOLDS.PERCENTILE, WINDOW_MONTHS, MIN_RECIPIENTS];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND (h.department = $${params.length} OR h.program = $${params.length})`;
    }
    params.push(limit);

    const r = await longQuery<ConcRow>(
      `WITH asof AS (SELECT ${CORPUS_AS_OF_SQL} AS d),
       base AS (
         SELECT owner_org_title AS department,
                prog_name_en AS program,
                COALESCE(recipient_business_number, recipient_legal_name) AS rkey,
                recipient_legal_name AS recipient,
                agreement_value
           FROM fed.grants_contributions, asof
          WHERE is_amendment = false
            AND agreement_value > 0
            AND owner_org_title IS NOT NULL
            AND prog_name_en IS NOT NULL
            AND recipient_legal_name IS NOT NULL
            AND agreement_start_date >  asof.d - ($4::int * INTERVAL '1 month')
            AND agreement_start_date <= asof.d
       ),
       pr AS (
         SELECT department, program, rkey, MAX(recipient) AS recipient,
                SUM(agreement_value) AS recipient_total
           FROM base
          GROUP BY department, program, rkey
       ),
       pt AS (
         SELECT department, program, SUM(recipient_total) AS prog_total, COUNT(*) AS recipient_count
           FROM pr GROUP BY department, program
       ),
       hhi AS (
         SELECT pr.department, pr.program, pt.prog_total, pt.recipient_count,
                ROUND(SUM(POWER(pr.recipient_total / NULLIF(pt.prog_total, 0) * 100, 2))) AS hhi
           FROM pr JOIN pt USING (department, program)
          WHERE pt.prog_total >= $1
            AND pt.recipient_count >= $5
          GROUP BY pr.department, pr.program, pt.prog_total, pt.recipient_count
       ),
       dept_p AS (
         SELECT department,
                percentile_cont($3) WITHIN GROUP (ORDER BY hhi) AS p90,
                COUNT(*) AS n
           FROM hhi GROUP BY department
       ),
       ranked AS (
         SELECT pr.department, pr.program, pr.recipient, pr.recipient_total,
                ROW_NUMBER() OVER (PARTITION BY pr.department, pr.program ORDER BY pr.recipient_total DESC) AS rn
           FROM pr JOIN hhi USING (department, program)
       )
       SELECT h.department, h.program, h.prog_total, h.recipient_count, h.hhi,
              dp.p90 AS dept_p90, dp.n AS dept_peer_count, asof.d AS corpus_as_of,
              MAX(r.recipient)       FILTER (WHERE r.rn = 1) AS top1_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 1) AS top1_value,
              MAX(r.recipient)       FILTER (WHERE r.rn = 2) AS top2_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 2) AS top2_value,
              MAX(r.recipient)       FILTER (WHERE r.rn = 3) AS top3_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 3) AS top3_value
         FROM hhi h
         JOIN dept_p dp USING (department)
         JOIN ranked r USING (department, program)
         CROSS JOIN asof
        WHERE h.hhi >= dp.p90
          AND h.hhi >= $2${extra}
        GROUP BY h.department, h.program, h.prog_total, h.recipient_count, h.hhi, dp.p90, dp.n, asof.d
        ORDER BY h.hhi DESC, h.prog_total DESC
        LIMIT $${params.length}`,
      params,
      filters.statementTimeoutMs ?? 60_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: ConcRow): PatternMatch | null {
  const hhi = num(row.hhi);
  if (hhi < HHI_FLOOR) return null;
  const department = row.department ?? "Unknown department";
  const program = row.program ?? "Unknown program";
  const total = num(row.prog_total);
  const top1 = num(row.top1_value);
  const top2 = num(row.top2_value);
  const top3 = num(row.top3_value);
  const top3Share = total > 0 ? ((top1 + top2 + top3) / total) * 100 : 0;
  const recipientCount = num(row.recipient_count);
  const p90 = num(row.dept_p90);
  const peers = num(row.dept_peer_count);
  const asOfIso = asIso(row.corpus_as_of);

  const band = hhi >= 5000 ? "extreme" : hhi >= 2500 ? "highly concentrated" : "moderately concentrated";
  const flags = { singleRecipient: recipientCount === 1, smallGroup: peers > 0 && peers < MIN_GROUP };
  const margin = Math.min(marginOver(hhi, HHI_FLOOR), p90 > 0 ? marginOver(hhi, p90) : Infinity);
  const severity = severityFor(hhi);
  const rowId = `${department} · ${program}`;

  return {
    patternId: "vendor-concentration",
    matchId: `vendor-concentration:${department}:${program}`,
    subject: { type: "program", id: program, canonicalName: program },
    evidence: [
      { source: "fed.grants_contributions", rowId, field: "hhi", value: hhi },
      { source: "fed.grants_contributions", rowId, field: "department", value: department },
      { source: "fed.grants_contributions", rowId, field: "program_total_36m", value: total },
      { source: "fed.grants_contributions", rowId, field: "recipient_count", value: recipientCount },
      { source: "fed.grants_contributions", rowId, field: "top1_recipient", value: row.top1_name },
      { source: "fed.grants_contributions", rowId, field: "top1_value", value: top1 },
      { source: "fed.grants_contributions", rowId, field: "top3_share_pct", value: top3Share.toFixed(1) },
      { source: "fed.grants_contributions", rowId, field: "dept_p90_hhi", value: Math.round(p90) },
      { source: "fed.grants_contributions", rowId, field: "window", value: asOfIso ? `${WINDOW_MONTHS} months to ${asOfIso.slice(0, 10)}` : `${WINDOW_MONTHS} months` },
    ],
    calibratedSummary: `The dataset shows ${department}'s program "${program}" disbursing ${compactDollar(total)} to ${recipientCount.toLocaleString("en-CA")} ${recipientCount === 1 ? "recipient" : "recipients"} over the ${WINDOW_MONTHS} months to ${asOfIso ? asOfIso.slice(0, 10) : "the corpus as-of date"}. HHI ${hhi.toFixed(0)} (${band}; department 90th percentile ${p90.toFixed(0)}); top recipients (${row.top1_name ?? "—"}${row.top2_name ? `, ${row.top2_name}` : ""}${row.top3_name ? `, ${row.top3_name}` : ""}) account for ${top3Share.toFixed(0)}% of program spend.`,
    severity,
    signalStrength: severityToSignalStrength(severity),
    signal: hhi,
    evidenceStrength: evidenceStrength({ margin: Number.isFinite(margin) ? margin : 0, flags }),
    benignNote: benignNoteFor("vendor-concentration", {
      name: row.top1_name,
      flags,
      preferred: recipientCount === 1 ? ["SINGLE_RECIPIENT_PROGRAM"] : [],
    }),
    department,
    province: null,
    fiscalYear: fiscalYearOf(asOfIso),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapVendorForTest(row: Partial<ConcRow>): PatternMatch | null {
  return mapRowToMatch({
    department: null, program: null, prog_total: null, recipient_count: null, hhi: null,
    dept_p90: null, dept_peer_count: null, corpus_as_of: null,
    top1_name: null, top1_value: null, top2_name: null, top2_value: null, top3_name: null, top3_value: null,
    ...row,
  });
}
export const _VENDOR_FLOORS_FOR_TEST = { PROGRAM_FLOOR, HHI_FLOOR, WINDOW_MONTHS, MIN_RECIPIENTS };
