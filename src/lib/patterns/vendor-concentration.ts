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
 * Vendor concentration. Adapted from the hackathon repo's
 * FED/scripts/advanced/04-recipient-concentration.js HHI calculation.
 *
 * For each department with total spend > $100M, compute HHI as the
 * sum of squared recipient shares × 10,000. HHI > 2500 = highly
 * concentrated (per US Justice Department merger guidelines).
 *
 * Each match is a (department, HHI, top recipients) tuple. The
 * subject is the department.
 */

interface ConcRow {
  department: string | null;
  dept_total: string | number | null;
  recipient_count: string | number | null;
  hhi: string | number | null;
  top1_name: string | null;
  top1_value: string | number | null;
  top2_name: string | null;
  top2_value: string | number | null;
  top3_name: string | null;
  top3_value: string | number | null;
}

const TOTAL_FLOOR = 100_000_000; // department must have ≥ $100M to be considered

function severityFor(hhi: number): SignalStrength {
  if (hhi >= 5000) return "flag";
  if (hhi >= 2500) return "attention";
  if (hhi >= 1500) return "observation";
  return "observation"; // (filtered out below this point anyway)
}

const dollar = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const compactDollar = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return dollar.format(v);
};

export const vendorConcentrationDetector: PatternDetector = {
  pattern: getPattern("vendor-concentration")!,

  async detect(filters: PatternFilters = {}): Promise<PatternMatch[]> {
    const limit = filters.limit ?? 50;
    const params: unknown[] = [TOTAL_FLOOR];
    let extra = "";
    if (filters.subjectId) {
      params.push(filters.subjectId);
      extra = ` AND owner_org_title = $${params.length}`;
    }
    params.push(limit);

    const r = await longQuery<ConcRow>(
      `WITH dept_recip AS (
         SELECT owner_org_title AS department,
                recipient_legal_name AS recipient,
                SUM(agreement_value) AS recipient_total
           FROM fed.grants_contributions
          WHERE is_amendment = false
            AND agreement_value > 0
            AND owner_org_title IS NOT NULL
            AND recipient_legal_name IS NOT NULL${extra}
          GROUP BY owner_org_title, recipient_legal_name
       ),
       dept_totals AS (
         SELECT department,
                SUM(recipient_total) AS dept_total,
                COUNT(*) AS recipient_count
           FROM dept_recip
          GROUP BY department
       ),
       hhi AS (
         SELECT dr.department,
                dt.dept_total,
                dt.recipient_count,
                ROUND(SUM(POWER(dr.recipient_total / NULLIF(dt.dept_total, 0) * 100, 2))) AS hhi
           FROM dept_recip dr
           JOIN dept_totals dt USING (department)
          GROUP BY dr.department, dt.dept_total, dt.recipient_count
       ),
       ranked AS (
         SELECT dr.department, dr.recipient, dr.recipient_total,
                ROW_NUMBER() OVER (PARTITION BY dr.department ORDER BY dr.recipient_total DESC) AS rn
           FROM dept_recip dr
           JOIN dept_totals dt USING (department)
          WHERE dt.dept_total >= $1
       )
       SELECT h.department,
              h.dept_total,
              h.recipient_count,
              h.hhi,
              MAX(r.recipient) FILTER (WHERE r.rn = 1) AS top1_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 1) AS top1_value,
              MAX(r.recipient) FILTER (WHERE r.rn = 2) AS top2_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 2) AS top2_value,
              MAX(r.recipient) FILTER (WHERE r.rn = 3) AS top3_name,
              MAX(r.recipient_total) FILTER (WHERE r.rn = 3) AS top3_value
         FROM hhi h
         JOIN ranked r USING (department)
        WHERE h.dept_total >= $1
          AND h.hhi >= 1500
        GROUP BY h.department, h.dept_total, h.recipient_count, h.hhi
        ORDER BY h.hhi DESC
        LIMIT $${params.length}`,
      params,
      45_000,
    );

    return r.rows
      .map((row) => mapRowToMatch(row))
      .filter((m): m is PatternMatch => m !== null)
      .filter((m) => meetsMinSignal(m.signalStrength, filters.minSignal));
  },
};

function mapRowToMatch(row: ConcRow): PatternMatch | null {
  const hhi = Number(row.hhi) || 0;
  if (hhi < 1500) return null;
  const department = row.department ?? "Unknown department";
  const total = Number(row.dept_total) || 0;
  const top1 = Number(row.top1_value) || 0;
  const top2 = Number(row.top2_value) || 0;
  const top3 = Number(row.top3_value) || 0;
  const top3Share = total > 0 ? ((top1 + top2 + top3) / total) * 100 : 0;
  const recipientCount = Number(row.recipient_count) || 0;

  const band =
    hhi >= 5000
      ? "extreme"
      : hhi >= 2500
        ? "highly concentrated"
        : "moderately concentrated";

  return {
    patternId: "vendor-concentration",
    matchId: `vendor-concentration:${department}`,
    subject: {
      type: "department",
      id: department,
      canonicalName: department,
    },
    evidence: [
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "hhi",
        value: hhi,
      },
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "dept_total",
        value: total,
      },
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "recipient_count",
        value: recipientCount,
      },
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "top1_recipient",
        value: row.top1_name,
      },
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "top1_value",
        value: top1,
      },
      {
        source: "fed.grants_contributions",
        rowId: department,
        field: "top3_share_pct",
        value: top3Share.toFixed(1),
      },
    ],
    calibratedSummary: `The dataset shows ${department} disbursing ${compactDollar(total)} across ${recipientCount.toLocaleString("en-CA")} recipients. HHI ${hhi.toFixed(0)} (${band}); top three recipients (${row.top1_name ?? "—"}, ${row.top2_name ?? "—"}, ${row.top3_name ?? "—"}) account for ${top3Share.toFixed(0)}% of total spend.`,
    signalStrength: severityFor(hhi),
    detectedAt: new Date().toISOString(),
  };
}

export function _mapVendorForTest(row: ConcRow): PatternMatch | null {
  return mapRowToMatch(row);
}
export const _VENDOR_FLOORS_FOR_TEST = { TOTAL_FLOOR };
