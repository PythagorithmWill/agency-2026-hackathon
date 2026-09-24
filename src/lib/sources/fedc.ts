/**
 * Query helpers over fedc.contracts (federal Proactive Publication –
 * Contracts over $10,000). Every function feature-detects the schema and
 * returns { available:false, rows:[] } when it is not loaded, so detectors
 * can run on databases without the federal contracts source.
 *
 * Value semantics (see docs/DATA-SOURCES.md): amendment rows restate the
 * cumulative total in contract_value, so per-procurement current value is
 * the LATEST row's contract_value (fedc.contracts_current), never SUM().
 */
import { query } from "../db/pool";
import { normFiscalYear, normName } from "./normalize";
import { EMPTY, hasTable, type SourceResult } from "./schema";

export interface FedContractRow {
  owner_org: string;
  owner_org_title: string | null;
  procurement_key: string;
  reference_number: string;
  vendor_name: string | null;
  vendor_postal_code: string | null;
  contract_date: string | null;
  fiscal_year: string | null;
  delivery_date: string | null;
  current_value: number | null;
  original_value: number | null;
  commodity_type: string | null;
  commodity_code: string | null;
  description_en: string | null;
  solicitation_procedure: string | null;
  limited_tendering_reason: string[] | null;
  number_of_bids: number | null;
  instrument_type: string | null;
}

export interface SoleSourceShareRow {
  owner_org: string;
  owner_org_title: string | null;
  fiscal_year: string;
  contracts: number;
  sole_source_contracts: number;
  total_value: number;
  sole_source_value: number;
  sole_source_share_count: number; // 0..1
  sole_source_share_value: number; // 0..1
}

export interface VendorConcentrationRow {
  owner_org: string;
  owner_org_title: string | null;
  fiscal_year: string;
  vendors: number;
  total_value: number;
  top_vendor: string | null;
  top_vendor_value: number;
  top_vendor_share: number; // 0..1
  hhi: number; // sum of squared value shares, 0..1
}

export interface VendorAmendmentGrowthRow {
  owner_org: string;
  procurement_key: string;
  vendor_name: string | null;
  original_value: number | null;
  current_value: number | null;
  growth_ratio: number | null;
  amendments: number;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

function toContractRow(r: Record<string, unknown>): FedContractRow {
  return {
    ...(r as unknown as FedContractRow),
    current_value: numOrNull(r.current_value),
    original_value: numOrNull(r.original_value),
    number_of_bids: numOrNull(r.number_of_bids),
  };
}

/**
 * Contracts (current value per procurement) for a vendor. Matches on the
 * normalised name exactly; with { fuzzy:true } uses a contains match, which
 * is slower (no index) but tolerates suffix differences.
 */
export async function contractsByVendor(
  nameOrBn: string,
  opts: { fuzzy?: boolean; limit?: number } = {},
): Promise<SourceResult<FedContractRow>> {
  const key = normName(nameOrBn);
  if (!key || !(await hasTable("fedc.contracts"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
  const where = opts.fuzzy ? "vendor_name_norm LIKE '%' || $1 || '%'" : "vendor_name_norm = $1";
  const r = await query<Record<string, unknown>>(
    `SELECT owner_org, owner_org_title, procurement_key, reference_number, vendor_name, vendor_postal_code,
            contract_date::text AS contract_date, fiscal_year, delivery_date::text AS delivery_date,
            current_value, original_value, commodity_type, commodity_code, description_en,
            solicitation_procedure, limited_tendering_reason, number_of_bids, instrument_type
       FROM fedc.contracts_current
      WHERE ${where}
      ORDER BY contract_date DESC NULLS LAST
      LIMIT $2`,
    [key, limit],
  );
  return { available: true, rows: r.rows.map(toContractRow) };
}

/**
 * Sole-source (solicitation_procedure = 'TN', "Non-Competitive") share per
 * department for a fiscal year, by count and by current value. Rows with a
 * NULL solicitation_procedure (pre-2020 schema) count in the denominators
 * only, so shares are conservative.
 */
export async function soleSourceShareByDepartment(
  fy: string,
  opts: { minContracts?: number } = {},
): Promise<SourceResult<SoleSourceShareRow>> {
  const fiscalYear = normFiscalYear(fy);
  if (!fiscalYear || !(await hasTable("fedc.contracts"))) return EMPTY();
  const minContracts = Math.max(opts.minContracts ?? 20, 1);
  const r = await query<Record<string, unknown>>(
    `SELECT owner_org, max(owner_org_title) AS owner_org_title, fiscal_year,
            count(*)::int AS contracts,
            count(*) FILTER (WHERE solicitation_procedure = 'TN')::int AS sole_source_contracts,
            COALESCE(sum(current_value), 0) AS total_value,
            COALESCE(sum(current_value) FILTER (WHERE solicitation_procedure = 'TN'), 0) AS sole_source_value
       FROM fedc.contracts_current
      WHERE fiscal_year = $1
      GROUP BY owner_org, fiscal_year
     HAVING count(*) >= $2
      ORDER BY sole_source_value DESC`,
    [fiscalYear, minContracts],
  );
  return {
    available: true,
    rows: r.rows.map((x) => {
      const contracts = num(x.contracts);
      const ss = num(x.sole_source_contracts);
      const total = num(x.total_value);
      const ssv = num(x.sole_source_value);
      return {
        owner_org: String(x.owner_org),
        owner_org_title: (x.owner_org_title as string | null) ?? null,
        fiscal_year: String(x.fiscal_year),
        contracts,
        sole_source_contracts: ss,
        total_value: total,
        sole_source_value: ssv,
        sole_source_share_count: contracts > 0 ? ss / contracts : 0,
        sole_source_share_value: total > 0 ? ssv / total : 0,
      };
    }),
  };
}

/** Vendor concentration per department for a fiscal year: top-vendor share and HHI of current value. */
export async function vendorConcentrationByDepartment(
  fy: string,
  opts: { minVendors?: number } = {},
): Promise<SourceResult<VendorConcentrationRow>> {
  const fiscalYear = normFiscalYear(fy);
  if (!fiscalYear || !(await hasTable("fedc.contracts"))) return EMPTY();
  const minVendors = Math.max(opts.minVendors ?? 5, 1);
  const r = await query<Record<string, unknown>>(
    `WITH v AS (
        SELECT owner_org, max(owner_org_title) AS owner_org_title, fiscal_year, vendor_name_norm,
               sum(current_value) AS value
          FROM fedc.contracts_current
         WHERE fiscal_year = $1 AND vendor_name_norm IS NOT NULL AND current_value > 0
         GROUP BY owner_org, fiscal_year, vendor_name_norm),
      d AS (
        SELECT owner_org, max(owner_org_title) AS owner_org_title, fiscal_year,
               count(*)::int AS vendors, sum(value) AS total_value,
               sum(value * value) / NULLIF(sum(value) * sum(value), 0) AS hhi
          FROM v GROUP BY owner_org, fiscal_year),
      t AS (
        SELECT DISTINCT ON (owner_org) owner_org, vendor_name_norm AS top_vendor, value AS top_vendor_value
          FROM v ORDER BY owner_org, value DESC)
     SELECT d.owner_org, d.owner_org_title, d.fiscal_year, d.vendors, d.total_value, d.hhi,
            t.top_vendor, t.top_vendor_value
       FROM d JOIN t USING (owner_org)
      WHERE d.vendors >= $2
      ORDER BY d.hhi DESC`,
    [fiscalYear, minVendors],
  );
  return {
    available: true,
    rows: r.rows.map((x) => {
      const total = num(x.total_value);
      const top = num(x.top_vendor_value);
      return {
        owner_org: String(x.owner_org),
        owner_org_title: (x.owner_org_title as string | null) ?? null,
        fiscal_year: String(x.fiscal_year),
        vendors: num(x.vendors),
        total_value: total,
        top_vendor: (x.top_vendor as string | null) ?? null,
        top_vendor_value: top,
        top_vendor_share: total > 0 ? top / total : 0,
        hhi: num(x.hhi),
      };
    }),
  };
}

/** Procurements for a vendor whose current value grew past `minRatio` × original through amendments. */
export async function amendmentGrowthByVendor(
  name: string,
  opts: { minRatio?: number; limit?: number } = {},
): Promise<SourceResult<VendorAmendmentGrowthRow>> {
  const key = normName(name);
  if (!key || !(await hasTable("fedc.contracts"))) return EMPTY();
  const minRatio = Math.max(opts.minRatio ?? 1.5, 1);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const r = await query<Record<string, unknown>>(
    `WITH a AS (
        SELECT owner_org, COALESCE(procurement_id, reference_number) AS procurement_key,
               count(*) FILTER (WHERE is_amendment)::int AS amendments
          FROM fedc.contracts WHERE vendor_name_norm = $1
         GROUP BY 1, 2)
     SELECT c.owner_org, c.procurement_key, c.vendor_name, c.original_value, c.current_value,
            CASE WHEN c.original_value > 0 THEN c.current_value / c.original_value END AS growth_ratio,
            a.amendments
       FROM fedc.contracts_current c JOIN a USING (owner_org, procurement_key)
      WHERE c.vendor_name_norm = $1 AND c.original_value > 0 AND c.current_value / c.original_value >= $2
      ORDER BY growth_ratio DESC
      LIMIT $3`,
    [key, minRatio, limit],
  );
  return {
    available: true,
    rows: r.rows.map((x) => ({
      owner_org: String(x.owner_org),
      procurement_key: String(x.procurement_key),
      vendor_name: (x.vendor_name as string | null) ?? null,
      original_value: numOrNull(x.original_value),
      current_value: numOrNull(x.current_value),
      growth_ratio: numOrNull(x.growth_ratio),
      amendments: num(x.amendments),
    })),
  };
}
