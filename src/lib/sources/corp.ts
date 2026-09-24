/**
 * Query helpers over corp.corporations / corp.directors (Corporations Canada
 * federal corporations). Feature-detects each table; corp.directors is
 * expected to be absent or empty until the per-corporation API loader runs.
 */
import { query } from "../db/pool";
import { normBn, normName, normPostal } from "./normalize";
import { EMPTY, hasTable, type SourceResult } from "./schema";

export interface CorporationRow {
  corporation_number: string;
  business_number: string | null;
  name_form1: string | null;
  name_form2: string | null;
  governing_legislation: string | null;
  status: string | null;
  status_detail: string | null;
  anniversary_date: string | null;
  year_of_last_annual_filing: number | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postal_code: string | null;
  min_directors: number | null;
  max_directors: number | null;
}

export interface DirectorRow {
  corporation_number: string;
  corporation_name: string | null;
  corporation_status: string | null;
  director_name: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  resident_canadian: boolean | null;
}

const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

function toCorp(r: Record<string, unknown>): CorporationRow {
  return {
    ...(r as unknown as CorporationRow),
    year_of_last_annual_filing: numOrNull(r.year_of_last_annual_filing),
    min_directors: numOrNull(r.min_directors),
    max_directors: numOrNull(r.max_directors),
  };
}

const SELECT = `SELECT corporation_number, business_number, name_form1, name_form2, governing_legislation, status, status_detail,
       anniversary_date::text AS anniversary_date, year_of_last_annual_filing, city, province, country, postal_code,
       min_directors, max_directors
  FROM corp.corporations`;

/**
 * Corporations by name (either name form) or by 9-digit business number.
 * A BN (9 or 15 digits) is detected automatically.
 */
export async function corporationsByNameOrBn(
  nameOrBn: string,
  opts: { limit?: number } = {},
): Promise<SourceResult<CorporationRow>> {
  const bn = normBn(nameOrBn);
  const key = normName(nameOrBn);
  if ((!bn && !key) || !(await hasTable("corp.corporations"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 2000);
  const r = bn
    ? await query<Record<string, unknown>>(`${SELECT} WHERE business_number = $1 ORDER BY corporation_number LIMIT $2`, [bn, limit])
    : await query<Record<string, unknown>>(
        `${SELECT} WHERE name_norm = $1 OR upper(trim(name_form2)) = $1 ORDER BY status, corporation_number LIMIT $2`,
        [key, limit],
      );
  return { available: true, rows: r.rows.map(toCorp) };
}

/** Corporations registered at a postal code (shared-address signal for related-parties). */
export async function corporationsByPostalCode(
  postalCode: string,
  opts: { limit?: number; activeOnly?: boolean } = {},
): Promise<SourceResult<CorporationRow>> {
  const postal = normPostal(postalCode);
  if (!postal || !(await hasTable("corp.corporations"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
  const active = opts.activeOnly ? " AND status = 'Active'" : "";
  const r = await query<Record<string, unknown>>(
    `${SELECT} WHERE postal_code = $1${active} ORDER BY status, name_norm LIMIT $2`,
    [postal, limit],
  );
  return { available: true, rows: r.rows.map(toCorp) };
}

/**
 * Directorships held by a person. Requires corp.directors, which the bulk
 * open dataset does not populate; returns available:false until the
 * per-corporation loader has run.
 */
export async function directorsByPerson(name: string, opts: { limit?: number } = {}): Promise<SourceResult<DirectorRow>> {
  const key = normName(name);
  if (!key || !(await hasTable("corp.directors"))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const r = await query<Record<string, unknown>>(
    `SELECT d.corporation_number, c.name_form1 AS corporation_name, c.status AS corporation_status,
            d.director_name, d.city, d.province, d.postal_code, d.resident_canadian
       FROM corp.directors d LEFT JOIN corp.corporations c USING (corporation_number)
      WHERE d.director_name_norm = $1
      ORDER BY c.status, c.name_form1 LIMIT $2`,
    [key, limit],
  );
  return { available: true, rows: r.rows as unknown as DirectorRow[] };
}

/** Directors of a corporation (same availability caveat as directorsByPerson). */
export async function directorsOfCorporation(corporationNumber: string): Promise<SourceResult<DirectorRow>> {
  const id = corporationNumber.trim();
  if (!/^\d{1,12}$/.test(id) || !(await hasTable("corp.directors"))) return EMPTY();
  const r = await query<Record<string, unknown>>(
    `SELECT d.corporation_number, c.name_form1 AS corporation_name, c.status AS corporation_status,
            d.director_name, d.city, d.province, d.postal_code, d.resident_canadian
       FROM corp.directors d LEFT JOIN corp.corporations c USING (corporation_number)
      WHERE d.corporation_number = $1 ORDER BY d.director_name`,
    [id],
  );
  return { available: true, rows: r.rows as unknown as DirectorRow[] };
}
