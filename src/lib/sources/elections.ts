/**
 * Query helpers over elections.contributions (Elections Canada – contributions
 * to all political entities). Feature-detects the schema; returns
 * { available:false, rows:[] } when the source is not loaded.
 */
import { query } from "../db/pool";
import { normName, normPostal } from "./normalize";
import { EMPTY, hasTable, type SourceResult } from "./schema";

export interface ContributionRow {
  src_line: number;
  political_entity: string | null;
  recipient: string | null;
  recipient_party: string | null;
  electoral_district: string | null;
  electoral_event: string | null;
  contributor_type: string | null;
  contributor_name: string | null;
  contributor_city: string | null;
  contributor_province: string | null;
  contributor_postal_code: string | null;
  received_date: string | null;
  fiscal_or_election_date: string | null;
  monetary_amount: number | null;
  non_monetary_amount: number | null;
}

export interface ContributionSummaryRow {
  contributor_name: string;
  recipient_party: string | null;
  contributions: number;
  total_amount: number;
  first_date: string | null;
  last_date: string | null;
}

const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function toRow(r: Record<string, unknown>): ContributionRow {
  return {
    ...(r as unknown as ContributionRow),
    src_line: Number(r.src_line),
    monetary_amount: numOrNull(r.monetary_amount),
    non_monetary_amount: numOrNull(r.non_monetary_amount),
  };
}

const SELECT = `SELECT src_line, political_entity, recipient, recipient_party, electoral_district, electoral_event,
       contributor_type, contributor_name, contributor_city, contributor_province, contributor_postal_code,
       received_date::text AS received_date, fiscal_or_election_date::text AS fiscal_or_election_date,
       monetary_amount, non_monetary_amount
  FROM elections.contributions`;

/**
 * Contributions by contributor name. The source writes individuals as
 * "LAST, FIRST" (upper-case); pass either that or "First Last" — both forms
 * are tried. Optional postal code narrows homonyms.
 */
export async function contributionsByName(
  name: string,
  opts: { postalCode?: string; limit?: number } = {},
): Promise<SourceResult<ContributionRow>> {
  const keys = nameVariants(name);
  if (keys.length === 0 || !(await hasTable("elections.contributions"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
  const postal = normPostal(opts.postalCode);
  const params: unknown[] = [keys, limit];
  let where = "contributor_name_norm = ANY($1)";
  if (postal) {
    params.push(postal);
    where += ` AND contributor_postal_code = $${params.length}`;
  }
  const r = await query<Record<string, unknown>>(
    `${SELECT} WHERE ${where} ORDER BY received_date DESC NULLS LAST, src_line LIMIT $2`,
    params,
  );
  return { available: true, rows: r.rows.map(toRow) };
}

/** Contributions from a postal code (all contributors), newest first. */
export async function contributionsByPostalCode(
  postalCode: string,
  opts: { limit?: number } = {},
): Promise<SourceResult<ContributionRow>> {
  const postal = normPostal(postalCode);
  if (!postal || !(await hasTable("elections.contributions"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
  const r = await query<Record<string, unknown>>(
    `${SELECT} WHERE contributor_postal_code = $1 ORDER BY received_date DESC NULLS LAST, src_line LIMIT $2`,
    [postal, limit],
  );
  return { available: true, rows: r.rows.map(toRow) };
}

/** Per-party totals for a contributor name (monetary + non-monetary). */
export async function contributionSummaryByName(name: string): Promise<SourceResult<ContributionSummaryRow>> {
  const keys = nameVariants(name);
  if (keys.length === 0 || !(await hasTable("elections.contributions"))) return EMPTY();
  const r = await query<Record<string, unknown>>(
    `SELECT contributor_name_norm AS contributor_name, recipient_party,
            count(*)::int AS contributions,
            COALESCE(sum(monetary_amount), 0) + COALESCE(sum(non_monetary_amount), 0) AS total_amount,
            min(received_date)::text AS first_date, max(received_date)::text AS last_date
       FROM elections.contributions
      WHERE contributor_name_norm = ANY($1)
      GROUP BY contributor_name_norm, recipient_party
      ORDER BY total_amount DESC`,
    [keys],
  );
  return {
    available: true,
    rows: r.rows.map((x) => ({
      contributor_name: String(x.contributor_name),
      recipient_party: (x.recipient_party as string | null) ?? null,
      contributions: num(x.contributions),
      total_amount: num(x.total_amount),
      first_date: (x.first_date as string | null) ?? null,
      last_date: (x.last_date as string | null) ?? null,
    })),
  };
}

/**
 * Name forms to try against contributor_name_norm. Exported for tests.
 *   "Jane Q Smith"  → ["JANE Q SMITH", "SMITH, JANE Q", "SMITH, JANE"]
 *   "Smith, Jane"   → ["SMITH, JANE", "JANE SMITH"]
 *   "Acme Inc."     → ["ACME INC."]
 */
export function nameVariants(raw: string): string[] {
  const n = normName(raw);
  if (!n) return [];
  const out = new Set<string>([n]);
  if (n.includes(",")) {
    const [last, first] = n.split(",", 2).map((s) => s.trim());
    if (last && first) out.add(`${first} ${last}`);
  } else {
    const parts = n.split(" ");
    if (parts.length >= 2 && parts.length <= 4) {
      const last = parts[parts.length - 1];
      const given = parts.slice(0, -1);
      out.add(`${last}, ${given.join(" ")}`);
      if (given.length > 1) out.add(`${last}, ${given[0]}`);
    }
  }
  return [...out];
}
