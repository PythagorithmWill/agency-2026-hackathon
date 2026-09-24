/**
 * Query helpers over the Registry of Lobbyists tables. The bulk export is
 * loaded header-driven (see scripts/ingest/lobby.ts), so this module reads
 * a typed VIEW, lobby.registrations_v, that must be created once the
 * export layout is known. Expected columns:
 *   registration_number text, client_name text, registrant_name text,
 *   registration_type text, effective_date date, end_date date,
 *   subject_matters text, institutions text
 * Until the view exists every helper returns { available:false, rows:[] }.
 */
import { query } from "../db/pool";
import { normName } from "./normalize";
import { EMPTY, hasTable, type SourceResult } from "./schema";

export interface LobbyRegistrationRow {
  registration_number: string;
  client_name: string | null;
  registrant_name: string | null;
  registration_type: string | null;
  effective_date: string | null;
  end_date: string | null;
  subject_matters: string | null;
  institutions: string | null;
}

export const LOBBY_VIEW = "lobby.registrations_v";

const SELECT = `SELECT registration_number, client_name, registrant_name, registration_type,
       effective_date::text AS effective_date, end_date::text AS end_date, subject_matters, institutions
  FROM ${LOBBY_VIEW}`;

/** Registrations where the named organisation is the client (the party paying for lobbying). */
export async function lobbyingByClient(name: string, opts: { limit?: number } = {}): Promise<SourceResult<LobbyRegistrationRow>> {
  const key = normName(name);
  if (!key || !(await hasTable(LOBBY_VIEW))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const r = await query<LobbyRegistrationRow>(
    `${SELECT} WHERE upper(trim(client_name)) = $1 ORDER BY effective_date DESC NULLS LAST LIMIT $2`,
    [key, limit],
  );
  return { available: true, rows: r.rows };
}

/** Registrations filed by a registrant (consultant or in-house lobbyist). */
export async function lobbyingByRegistrant(name: string, opts: { limit?: number } = {}): Promise<SourceResult<LobbyRegistrationRow>> {
  const key = normName(name);
  if (!key || !(await hasTable(LOBBY_VIEW))) return EMPTY();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const r = await query<LobbyRegistrationRow>(
    `${SELECT} WHERE upper(trim(registrant_name)) = $1 ORDER BY effective_date DESC NULLS LAST LIMIT $2`,
    [key, limit],
  );
  return { available: true, rows: r.rows };
}

/** CSV header → safe snake_case identifier (used by scripts/ingest/lobby.ts). */
export function toIdent(h: string, i: number): string {
  const s = h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return s && /^[a-z]/.test(s) ? s : `col_${i}`;
}

/** Deduplicate identifiers (c, c_2, c_3 …). */
export function uniqueIdents(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = seen.get(n) ?? 0;
    seen.set(n, k + 1);
    return k === 0 ? n : `${n}_${k + 1}`;
  });
}
