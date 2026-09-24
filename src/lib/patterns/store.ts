import { query } from "../db/pool";
import { hasAppTable, forgetAppTable, isUndefinedTable } from "../db/features";
import { loadSnapshot } from "../analytics/snapshot";
import type { PatternMatch, PatternEvidence, Severity } from "./types";
import { severityToSignalStrength, signalStrengthToSeverity } from "./strength";

/**
 * Pattern-match store — the read interface the pages code against.
 *
 * Source of truth is `app.pattern_matches` (every detector, unbounded,
 * written by scripts/refresh-derived.ts). When the table is absent or
 * empty the store falls back to `data/analytics-snapshot.json`
 * `patternMatches` (top 50 per pattern, legacy shape) and reports
 * `source: "snapshot"` so the page can say so.
 */

export interface PatternMatchRow {
  patternId: string;
  matchId: string;
  subject: {
    type: "recipient" | "agreement" | "program" | "department";
    id: string;
    canonicalName: string;
  };
  severity: "low" | "medium" | "high" | "critical";
  signal: number;
  evidenceStrength: number;
  benignNote: string | null;
  calibratedSummary: string;
  evidence: Array<{ source: string; rowId: string; field: string; value: string | number | null; asOf?: string }>;
  department: string | null;
  province: string | null;
  fiscalYear: number | null;
  computedAt: string;
}

export interface LoadPatternMatchesOpts {
  patternId: string;
  limit?: number;
  offset?: number;
  department?: string;
  province?: string;
  fyFrom?: number;
  minStrength?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

interface DbRow {
  pattern_id: string;
  match_id: string;
  subject_type: PatternMatchRow["subject"]["type"];
  subject_id: string;
  canonical_name: string;
  severity: Severity;
  signal: string | number;
  evidence: PatternEvidence[] | null;
  calibrated_summary: string;
  evidence_strength: string | number;
  benign_note: string | null;
  department: string | null;
  province: string | null;
  fiscal_year: number | null;
  computed_at: string | Date;
  total?: string | number;
}

function toIso(v: string | Date | null | undefined): string {
  if (v == null) return new Date(0).toISOString();
  if (typeof v === "string") return v;
  return v.toISOString();
}

function dbRowToRow(r: DbRow): PatternMatchRow {
  return {
    patternId: r.pattern_id,
    matchId: r.match_id,
    subject: { type: r.subject_type, id: r.subject_id, canonicalName: r.canonical_name },
    severity: r.severity,
    signal: Number(r.signal) || 0,
    evidenceStrength: Number(r.evidence_strength) || 0,
    benignNote: r.benign_note ?? null,
    calibratedSummary: r.calibrated_summary,
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    department: r.department ?? null,
    province: r.province ?? null,
    fiscalYear: r.fiscal_year ?? null,
    computedAt: toIso(r.computed_at),
  };
}

/* ─── snapshot mapping ──────────────────────────────────────────────── */

/**
 * Map one snapshot `patternMatches[slug][i]` entry (the detector's
 * PatternMatch shape — legacy entries carry only `signalStrength`) to a
 * store row. evidenceStrength defaults to 0.5 and benignNote to null when
 * the entry predates methodology v2.
 */
export function snapshotMatchToRow(raw: unknown): PatternMatchRow | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<PatternMatch> & { signalStrength?: string };
  if (!m.patternId || !m.matchId || !m.subject) return null;
  const severity: Severity =
    m.severity && ["low", "medium", "high", "critical"].includes(m.severity)
      ? m.severity
      : signalStrengthToSeverity(m.signalStrength);
  const strength = typeof m.evidenceStrength === "number" && Number.isFinite(m.evidenceStrength)
    ? m.evidenceStrength
    : 0.5;
  return {
    patternId: m.patternId,
    matchId: m.matchId,
    subject: {
      type: m.subject.type,
      id: m.subject.id,
      canonicalName: m.subject.canonicalName,
    },
    severity,
    signal: typeof m.signal === "number" && Number.isFinite(m.signal) ? m.signal : severityRank(severity),
    evidenceStrength: strength,
    benignNote: typeof m.benignNote === "string" ? m.benignNote : null,
    calibratedSummary: m.calibratedSummary ?? "",
    evidence: Array.isArray(m.evidence) ? m.evidence : [],
    department: typeof m.department === "string" ? m.department : null,
    province: typeof m.province === "string" ? m.province : null,
    fiscalYear: typeof m.fiscalYear === "number" ? m.fiscalYear : null,
    computedAt: m.detectedAt ?? new Date(0).toISOString(),
  };
}

function severityRank(s: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[s];
}

/** Store row → detector PatternMatch (used by build-snapshot so static pages share one shape). */
export function rowToDetectorMatch(row: PatternMatchRow): PatternMatch {
  return {
    patternId: row.patternId,
    matchId: row.matchId,
    subject: row.subject,
    evidence: row.evidence,
    calibratedSummary: row.calibratedSummary,
    severity: row.severity,
    signalStrength: severityToSignalStrength(row.severity),
    signal: row.signal,
    evidenceStrength: row.evidenceStrength,
    benignNote: row.benignNote,
    department: row.department,
    province: row.province,
    fiscalYear: row.fiscalYear,
    detectedAt: row.computedAt,
  };
}

async function snapshotRows(patternId: string): Promise<PatternMatchRow[]> {
  const snap = await loadSnapshot();
  const list = (snap?.patternMatches?.[patternId] ?? []) as unknown[];
  return list.map(snapshotMatchToRow).filter((r): r is PatternMatchRow => r !== null);
}

function applyFilters(rows: PatternMatchRow[], opts: LoadPatternMatchesOpts): PatternMatchRow[] {
  return rows.filter(
    (r) =>
      (opts.department == null || r.department === opts.department) &&
      (opts.province == null || r.province === opts.province) &&
      (opts.fyFrom == null || (r.fiscalYear != null && r.fiscalYear >= opts.fyFrom)) &&
      (opts.minStrength == null || r.evidenceStrength >= opts.minStrength),
  );
}

/* ─── public interface ─────────────────────────────────────────────── */

export async function loadPatternMatches(opts: LoadPatternMatchesOpts): Promise<{
  rows: PatternMatchRow[];
  total: number;
  source: "table" | "snapshot";
}> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, opts.offset ?? 0);

  if (await hasAppTable("pattern_matches")) {
    const params: unknown[] = [opts.patternId];
    const where: string[] = ["pattern_id = $1"];
    if (opts.department != null) {
      params.push(opts.department);
      where.push(`department = $${params.length}`);
    }
    if (opts.province != null) {
      params.push(opts.province);
      where.push(`province = $${params.length}`);
    }
    if (opts.fyFrom != null) {
      params.push(opts.fyFrom);
      where.push(`fiscal_year >= $${params.length}`);
    }
    if (opts.minStrength != null) {
      params.push(opts.minStrength);
      where.push(`evidence_strength >= $${params.length}`);
    }
    params.push(limit, offset);
    try {
      const r = await query<DbRow>(
        `SELECT pattern_id, match_id, subject_type, subject_id, canonical_name, severity, signal,
                evidence, calibrated_summary, evidence_strength, benign_note,
                department, province, fiscal_year, computed_at,
                COUNT(*) OVER () AS total
           FROM app.pattern_matches
          WHERE ${where.join(" AND ")}
          ORDER BY signal DESC, evidence_strength DESC, match_id
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      const total = r.rows.length > 0 ? Number(r.rows[0].total) || 0 : await countFiltered(where, params.slice(0, -2));
      return { rows: r.rows.map(dbRowToRow), total, source: "table" };
    } catch (err) {
      if (isUndefinedTable(err)) forgetAppTable("pattern_matches");
      else throw err;
    }
  }

  const all = applyFilters(await snapshotRows(opts.patternId), opts).sort(
    (a, b) => b.signal - a.signal || b.evidenceStrength - a.evidenceStrength || a.matchId.localeCompare(b.matchId),
  );
  return { rows: all.slice(offset, offset + limit), total: all.length, source: "snapshot" };
}

async function countFiltered(where: string[], params: unknown[]): Promise<number> {
  const r = await query<{ n: string | number }>(
    `SELECT COUNT(*) AS n FROM app.pattern_matches WHERE ${where.join(" AND ")}`,
    params,
  );
  return Number(r.rows[0]?.n) || 0;
}

/** pattern_id → total matches. */
export async function loadPatternCounts(): Promise<Record<string, number>> {
  if (await hasAppTable("pattern_matches")) {
    try {
      const r = await query<{ pattern_id: string; n: string | number }>(
        `SELECT pattern_id, COUNT(*) AS n FROM app.pattern_matches GROUP BY pattern_id`,
      );
      const out: Record<string, number> = {};
      for (const row of r.rows) out[row.pattern_id] = Number(row.n) || 0;
      return out;
    } catch (err) {
      if (isUndefinedTable(err)) forgetAppTable("pattern_matches");
      else throw err;
    }
  }
  const snap = await loadSnapshot();
  const out: Record<string, number> = {};
  for (const [slug, list] of Object.entries(snap?.patternMatches ?? {})) {
    out[slug] = Array.isArray(list) ? list.length : 0;
  }
  return out;
}

export async function loadPatternFilters(patternId: string): Promise<{
  departments: string[];
  provinces: string[];
  fyRange: { min: number; max: number } | null;
}> {
  if (await hasAppTable("pattern_matches")) {
    try {
      const r = await query<{
        departments: string[] | null;
        provinces: string[] | null;
        fy_min: number | null;
        fy_max: number | null;
      }>(
        `SELECT
           (SELECT array_agg(d ORDER BY d) FROM (SELECT DISTINCT department AS d FROM app.pattern_matches WHERE pattern_id = $1 AND department IS NOT NULL) x) AS departments,
           (SELECT array_agg(p ORDER BY p) FROM (SELECT DISTINCT province AS p FROM app.pattern_matches WHERE pattern_id = $1 AND province IS NOT NULL) y) AS provinces,
           MIN(fiscal_year) AS fy_min,
           MAX(fiscal_year) AS fy_max
         FROM app.pattern_matches
         WHERE pattern_id = $1`,
        [patternId],
      );
      const row = r.rows[0];
      return {
        departments: row?.departments ?? [],
        provinces: row?.provinces ?? [],
        fyRange: row?.fy_min != null && row?.fy_max != null ? { min: Number(row.fy_min), max: Number(row.fy_max) } : null,
      };
    } catch (err) {
      if (isUndefinedTable(err)) forgetAppTable("pattern_matches");
      else throw err;
    }
  }
  const rows = await snapshotRows(patternId);
  const departments = [...new Set(rows.map((r) => r.department).filter((d): d is string => !!d))].sort();
  const provinces = [...new Set(rows.map((r) => r.province).filter((p): p is string => !!p))].sort();
  const fys = rows.map((r) => r.fiscalYear).filter((y): y is number => typeof y === "number");
  return {
    departments,
    provinces,
    fyRange: fys.length > 0 ? { min: Math.min(...fys), max: Math.max(...fys) } : null,
  };
}
