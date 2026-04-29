import { query } from "../db/pool";
import type { ComparableRecord } from "../types";
import { generateMockComparables } from "./mockComparables";

/**
 * Real federal-grants retrieval against fed.grants_contributions on the
 * Render Postgres replica. Hand-built FTS pipeline:
 *
 *   1. F-3 max-amendment CTE — DISTINCT ON (ref_number, COALESCE(bn, legal,
 *      _id)) ORDER BY ... amendment_number DESC NULLS LAST, _id DESC. So
 *      "current" agreement value is what scores against the draft.
 *   2. Amount-range prefilter (±anticipatedAmount × {0.4, 2.5}) using the
 *      btree idx_fed_gc_value index. Drops the working set ~10× and brings
 *      the query under 2s without an FTS index on description_en.
 *   3. to_tsquery('english', '<kw1> | <kw2> | ...') — OR-ed keyword set
 *      extracted from draft + title. Stopwords stripped.
 *   4. ts_rank_cd(..., 32) — length-normalized rank. Returned, then
 *      max-normalized to 0..1 for the UI similarity bar.
 *
 * Falls back to mockComparables in two cases:
 *   - the keyword extractor returns nothing (degenerate draft text)
 *   - the query returns zero rows after FTS (sparse query)
 *   - the query throws (network, timeout, DB unreachable)
 *
 * Each fallback emits a clear warning to stderr so the operator can see
 * we're not silently shipping mocks.
 */

const EN_STOPWORDS = new Set([
  "the","a","an","and","or","but","of","for","to","in","on","at","by",
  "with","this","that","will","be","is","are","was","were","been","being",
  "as","it","its","from","into","over","under","across","up","down","out",
  "off","than","then","when","where","while","via","per","each","any","all",
  "some","such","not","no","yes","also","may","can","could","should","would",
  "funding","contribution","program","project","support","provide","deliver",
  "ensure","including","new","amount","year","fiscal","federal","government",
  "canada","canadian","upon","through","during","within","between","without",
  "shall","must","work","work","work","other","these","those","there","here",
  "have","has","had","having","do","does","did","done","make","made","makes",
  "use","used","using","get","got","getting","take","takes","took","taken",
]);

const KEYWORD_RE = /[\p{L}\p{N}]+/gu;

function extractKeywords(text: string, maxN: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.toLowerCase().matchAll(KEYWORD_RE)) {
    const t = m[0];
    if (t.length < 4 || EN_STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxN) break;
  }
  return out;
}

/** Build an OR-ed tsquery from the draft + title. Sanitized for to_tsquery. */
function tsqueryFor(draftText: string, workingTitle: string): string {
  const titleKw = extractKeywords(workingTitle, 4);
  const draftKw = extractKeywords(draftText, 10);
  const dedup = Array.from(new Set([...titleKw, ...draftKw])).slice(0, 12);
  // to_tsquery requires escaped tokens — strip everything but a-z0-9
  const safe = dedup
    .map((k) => k.replace(/[^a-z0-9]/g, ""))
    .filter((k) => k.length >= 3);
  return safe.join(" | ");
}

function fiscalYearOf(d: Date | string | null): number {
  if (!d) return new Date().getFullYear();
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return new Date().getFullYear();
  // Year alignment: April–March, end-year label per agency2026-data-skill
  return date.getMonth() >= 3 ? date.getFullYear() + 1 : date.getFullYear();
}

interface Row {
  ref_number: string | null;
  recipient_legal_name: string | null;
  recipient_business_number: string | null;
  recipient_province: string | null;
  owner_org_title: string | null;
  prog_name_en: string | null;
  agreement_value: string | number | null;
  agreement_start_date: string | null;
  description_en: string | null;
  rank: string | number;
}

export async function retrieveComparables(
  draftText: string,
  workingTitle: string,
  anticipatedAmount: number,
  _awardingDept: string,
): Promise<ComparableRecord[]> {
  const tsq = tsqueryFor(draftText, workingTitle);
  if (!tsq) {
    console.warn(
      "[retrieve] SHIPPING_MOCK_FALLBACK — keyword extractor returned nothing",
    );
    return generateMockComparables(draftText, workingTitle);
  }

  // ±anticipatedAmount × {0.4, 2.5}; sane bounds when amount is zero/missing
  const minAmount =
    anticipatedAmount > 0 ? Math.max(100_000, anticipatedAmount * 0.4) : 100_000;
  const maxAmount =
    anticipatedAmount > 0 ? anticipatedAmount * 2.5 : 250_000_000;

  const sql = `
    WITH agreement_current AS (
      SELECT DISTINCT ON (
        ref_number,
        COALESCE(recipient_business_number, recipient_legal_name, _id::text)
      )
        ref_number, recipient_legal_name, recipient_business_number,
        recipient_province, owner_org_title, prog_name_en,
        agreement_value, agreement_start_date, description_en,
        ts_rank_cd(
          to_tsvector('english', description_en),
          to_tsquery('english', $1),
          32
        ) AS rank
      FROM fed.grants_contributions
      WHERE agreement_value BETWEEN $2 AND $3
        AND description_en IS NOT NULL
        AND length(description_en) >= 80
        AND to_tsvector('english', description_en) @@ to_tsquery('english', $1)
      ORDER BY
        ref_number,
        COALESCE(recipient_business_number, recipient_legal_name, _id::text),
        NULLIF(amendment_number, '')::int DESC NULLS LAST,
        _id DESC
    )
    SELECT * FROM agreement_current
    ORDER BY rank DESC
    LIMIT 12
  `;

  let rows: Row[];
  try {
    const r = await query<Row>(sql, [tsq, minAmount, maxAmount]);
    rows = r.rows;
  } catch (err) {
    console.warn(
      "[retrieve] SHIPPING_MOCK_FALLBACK — query threw:",
      (err as Error).message,
    );
    return generateMockComparables(draftText, workingTitle);
  }

  if (rows.length === 0) {
    console.warn(
      `[retrieve] SHIPPING_MOCK_FALLBACK — 0 rows for tsquery '${tsq}'`,
    );
    return generateMockComparables(draftText, workingTitle);
  }

  const maxRank = Math.max(...rows.map((r) => Number(r.rank) || 0), 1e-6);

  return rows.map((row, i): ComparableRecord => {
    const desc = row.description_en ?? "";
    const excerpt = desc.length > 240 ? desc.slice(0, 240) + "…" : desc;
    const sim = Math.max(0, Math.min(1, Number(row.rank) / maxRank));
    return {
      recordId: row.ref_number ?? `fed-${i}`,
      sourceDataset: "fed",
      recipientLegalName: row.recipient_legal_name ?? "—",
      recipientBn: row.recipient_business_number ?? null,
      recipientProvince: row.recipient_province ?? null,
      awardingDept: row.owner_org_title ?? "—",
      programCode: row.prog_name_en ?? null,
      fiscalYear: fiscalYearOf(row.agreement_start_date),
      agreementValue: Number(row.agreement_value) || 0,
      description: excerpt,
      similarity: sim,
      retrievalReason: "keyword",
    };
  });
}
