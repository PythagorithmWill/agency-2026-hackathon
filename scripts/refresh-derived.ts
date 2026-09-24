#!/usr/bin/env tsx
/**
 * Rebuild the derived `app.*` layer:
 *   1. app.agreement_current + recipient/department/program rollups (F-1/F-3 canonical)
 *   2. app.pattern_matches — every live detector, unbounded (safety cap 20,000/pattern)
 *   3. app.data_quality_scorecard — every computable KNOWN-DATA-ISSUES id
 *
 * Usage:
 *   DATABASE_URL=postgresql://localhost:5432/agency26 npx tsx scripts/refresh-derived.ts [--only=canonical,patterns,dq]
 *
 * DATABASE_URL is REQUIRED (no .env.local fallback — this script writes,
 * and must never be pointed at a database by accident). It only ever
 * creates/replaces objects in schema `app`.
 *
 * Every table is built as app.<table>__new and swapped in atomically, so
 * the site keeps serving the previous version until the swap commits.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (e.g. postgresql://localhost:5432/agency26)");
  process.exit(2);
}

import type { PoolClient } from "pg";
import {
  adminPool,
  applyMigration,
  buildAndSwap,
  batchInsert,
  setMeta,
  grantAppRole,
  describeDb,
  timed,
} from "../src/lib/db/refresh";
import { closePool } from "../src/lib/db/pool";
import { _resetFeatureMemoForTest } from "../src/lib/db/features";
import { nullLikeBnSql } from "../src/lib/patterns/identity";
import { listLiveDetectors } from "../src/lib/patterns/detectors";
import type { PatternMatch } from "../src/lib/patterns/types";
import { DQ_CATALOGUE } from "../src/lib/analytics/dataQuality";

const PATTERN_SAFETY_CAP = 20_000;
const DETECTOR_TIMEOUT_MS = 30 * 60 * 1000;
const log = (m: string) => console.log(m);

const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? ["canonical", "patterns", "dq"];
const want = (s: string) => only.includes(s);

const FY_SQL = (col: string) =>
  `(EXTRACT(YEAR FROM ${col})::int + CASE WHEN EXTRACT(MONTH FROM ${col}) >= 4 THEN 1 ELSE 0 END)`;

/* ─── 1. canonical layer ────────────────────────────────────────────── */

async function buildAgreementCurrent(client: PoolClient): Promise<number> {
  const bnNullLike = nullLikeBnSql("cur.recipient_business_number");
  return buildAndSwap(
    client,
    "agreement_current",
    async (tmp) => {
      const r = await client.query(
        `INSERT INTO ${tmp} (
           ref_number, agreement_key, row_id, recipient_key, recipient_bn, recipient_bn_raw, is_placeholder_bn,
           recipient_legal_name, recipient_type, recipient_province, recipient_city, owner_org, department, program,
           current_value, original_value, original_is_amendment, amendment_count, amendment_max_n,
           first_amendment_date, last_amendment_date, agreement_start_date, agreement_end_date, fiscal_year,
           description, has_negative_rows, has_duplicate_rows)
         WITH base AS (
           -- Same base filter as the request-path CTE (queries.ts fedCurrentCte)
           -- so every total reconciles exactly.
           SELECT _id, ref_number,
                  COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
                  NULLIF(amendment_number, '')::int AS amend_n,
                  is_amendment, agreement_value, amendment_date,
                  recipient_business_number, recipient_legal_name, recipient_type, recipient_province, recipient_city,
                  owner_org, owner_org_title, prog_name_en, agreement_start_date, agreement_end_date, description_en
             FROM fed.grants_contributions
            WHERE agreement_value > 0 AND recipient_legal_name IS NOT NULL
         ),
         cur AS (
           SELECT DISTINCT ON (ref_number, agreement_key) *
             FROM base
            ORDER BY ref_number, agreement_key, amend_n DESC NULLS LAST, _id DESC
         ),
         orig AS (
           SELECT DISTINCT ON (ref_number, agreement_key) ref_number, agreement_key,
                  agreement_value AS original_value, is_amendment AS original_is_amendment
             FROM base
            ORDER BY ref_number, agreement_key, amend_n ASC NULLS FIRST, _id ASC
         ),
         agg AS (
           SELECT ref_number, agreement_key,
                  COUNT(*) FILTER (WHERE is_amendment) AS amendment_count,
                  MAX(amend_n) AS amendment_max_n,
                  MIN(amendment_date) FILTER (WHERE is_amendment) AS first_amendment_date,
                  MAX(amendment_date) FILTER (WHERE is_amendment) AS last_amendment_date
             FROM base GROUP BY ref_number, agreement_key
         ),
         dq AS (
           -- Chain-level data-quality flags over ALL rows of the chain (unfiltered).
           SELECT ref_number,
                  COALESCE(recipient_business_number, recipient_legal_name, _id::text) AS agreement_key,
                  bool_or(agreement_value < 0) AS has_negative_rows,
                  COUNT(*) > COUNT(DISTINCT NULLIF(amendment_number, '')::int) AS has_duplicate_rows
             FROM fed.grants_contributions
            GROUP BY 1, 2
         )
         SELECT cur.ref_number, cur.agreement_key, cur._id,
                COALESCE(cur.recipient_business_number, cur.recipient_legal_name) AS recipient_key,
                CASE WHEN ${bnNullLike} THEN NULL ELSE btrim(cur.recipient_business_number) END AS recipient_bn,
                cur.recipient_business_number,
                (cur.recipient_business_number IS NOT NULL AND ${bnNullLike}) AS is_placeholder_bn,
                cur.recipient_legal_name, cur.recipient_type, cur.recipient_province, cur.recipient_city,
                cur.owner_org, cur.owner_org_title, cur.prog_name_en,
                cur.agreement_value, orig.original_value, orig.original_is_amendment,
                agg.amendment_count, agg.amendment_max_n, agg.first_amendment_date, agg.last_amendment_date,
                cur.agreement_start_date, cur.agreement_end_date,
                CASE WHEN cur.agreement_start_date IS NULL THEN NULL ELSE ${FY_SQL("cur.agreement_start_date")} END,
                cur.description_en,
                COALESCE(dq.has_negative_rows, false), COALESCE(dq.has_duplicate_rows, false)
           FROM cur
           JOIN orig USING (ref_number, agreement_key)
           JOIN agg  USING (ref_number, agreement_key)
           LEFT JOIN dq USING (ref_number, agreement_key)`,
      );
      return r.rowCount ?? 0;
    },
    log,
  );
}

async function buildRollups(client: PoolClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.recipient_rollup = await buildAndSwap(client, "recipient_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (recipient_legal_name, recipient_bn_raw, recipient_bn, is_placeholder_bn, recipient_province,
                           total, agreement_count, department_count, program_count, fy_min, fy_max, first_start_date, last_start_date)
       SELECT recipient_legal_name, recipient_bn_raw, MAX(recipient_bn), bool_or(is_placeholder_bn), MAX(recipient_province),
              SUM(current_value), COUNT(*), COUNT(DISTINCT department), COUNT(DISTINCT program),
              MIN(fiscal_year), MAX(fiscal_year), MIN(agreement_start_date), MAX(agreement_start_date)
         FROM app.agreement_current
        WHERE recipient_legal_name IS NOT NULL
        GROUP BY recipient_legal_name, recipient_bn_raw`,
    );
    return r.rowCount ?? 0;
  }, log);
  out.department_rollup = await buildAndSwap(client, "department_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (department, total, agreement_count, recipient_count, program_count, fy_min, fy_max)
       SELECT department, SUM(current_value), COUNT(*), COUNT(DISTINCT recipient_key), COUNT(DISTINCT program),
              MIN(fiscal_year), MAX(fiscal_year)
         FROM app.agreement_current
        WHERE department IS NOT NULL
        GROUP BY department`,
    );
    return r.rowCount ?? 0;
  }, log);
  out.overview_rollup = await buildAndSwap(client, "overview_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (id, total, agreement_count, recipient_count, department_count, program_count, fy_min, fy_max, no_description_total)
       SELECT 1, SUM(current_value), COUNT(*), COUNT(DISTINCT recipient_key), COUNT(DISTINCT department), COUNT(DISTINCT program),
              MIN(fiscal_year), MAX(fiscal_year),
              COALESCE(SUM(current_value) FILTER (WHERE description IS NULL OR btrim(description) = ''), 0)
         FROM app.agreement_current
        WHERE current_value >= 1`,
    );
    return r.rowCount ?? 0;
  }, log);
  out.fiscal_year_rollup = await buildAndSwap(client, "fiscal_year_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (fiscal_year, total, agreement_count, recipient_count, program_count)
       SELECT fiscal_year, SUM(current_value), COUNT(*), COUNT(DISTINCT recipient_key), COUNT(DISTINCT program)
         FROM app.agreement_current
        WHERE current_value >= 1 AND fiscal_year IS NOT NULL
        GROUP BY fiscal_year`,
    );
    return r.rowCount ?? 0;
  }, log);
  out.province_rollup = await buildAndSwap(client, "province_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (province, total, agreement_count, recipient_count)
       SELECT recipient_province, SUM(current_value), COUNT(*), COUNT(DISTINCT recipient_key)
         FROM app.agreement_current
        WHERE recipient_province IS NOT NULL
        GROUP BY recipient_province`,
    );
    return r.rowCount ?? 0;
  }, log);
  out.program_rollup = await buildAndSwap(client, "program_rollup", async (tmp) => {
    const r = await client.query(
      `INSERT INTO ${tmp} (program, department, total, agreement_count, recipient_count, fy_min, fy_max)
       SELECT program, COALESCE(department, '—'), SUM(current_value), COUNT(*), COUNT(DISTINCT recipient_key),
              MIN(fiscal_year), MAX(fiscal_year)
         FROM app.agreement_current
        WHERE program IS NOT NULL
        GROUP BY program, COALESCE(department, '—')`,
    );
    return r.rowCount ?? 0;
  }, log);
  return out;
}

/* ─── 2. pattern matches ────────────────────────────────────────────── */

const PM_COLUMNS = [
  "pattern_id", "match_id", "subject_type", "subject_id", "canonical_name", "severity", "signal",
  "evidence", "calibrated_summary", "evidence_strength", "benign_note", "department", "province", "fiscal_year", "computed_at",
];

function matchToRow(m: PatternMatch, computedAt: string): unknown[] {
  return [
    m.patternId, m.matchId, m.subject.type, m.subject.id, m.subject.canonicalName, m.severity,
    Number.isFinite(m.signal) ? m.signal : 0,
    JSON.stringify(m.evidence ?? []), m.calibratedSummary,
    Math.min(1, Math.max(0, Number.isFinite(m.evidenceStrength) ? m.evidenceStrength : 0.5)),
    m.benignNote ?? null, m.department ?? null, m.province ?? null, m.fiscalYear ?? null, computedAt,
  ];
}

async function buildPatternMatches(client: PoolClient): Promise<Record<string, { count: number; capHit: boolean; ms: number; error?: string }>> {
  const runs: Record<string, { count: number; capHit: boolean; ms: number; error?: string }> = {};
  const computedAt = new Date().toISOString();
  const collected: unknown[][] = [];

  for (const det of listLiveDetectors()) {
    const slug = det.pattern.id;
    const t0 = Date.now();
    try {
      const matches = await det.detect({ limit: PATTERN_SAFETY_CAP, statementTimeoutMs: DETECTOR_TIMEOUT_MS });
      // Defensive de-dup on match_id (PK); keep the higher signal.
      const byId = new Map<string, PatternMatch>();
      for (const m of matches) {
        const prev = byId.get(m.matchId);
        if (!prev || m.signal > prev.signal) byId.set(m.matchId, m);
      }
      const ms = Date.now() - t0;
      const capHit = matches.length >= PATTERN_SAFETY_CAP;
      runs[slug] = { count: byId.size, capHit, ms };
      log(`✓ detect:${slug.padEnd(28)} ${(ms / 1000).toFixed(1).padStart(8)}s  ${byId.size.toLocaleString("en-CA")} matches${capHit ? "  ⚠ SAFETY CAP HIT" : ""}${byId.size !== matches.length ? `  (${matches.length - byId.size} duplicate ids dropped)` : ""}`);
      for (const m of byId.values()) collected.push(matchToRow(m, computedAt));
    } catch (err) {
      const ms = Date.now() - t0;
      runs[slug] = { count: 0, capHit: false, ms, error: (err as Error).message };
      log(`✗ detect:${slug.padEnd(28)} ${(ms / 1000).toFixed(1).padStart(8)}s  ERROR ${(err as Error).message}`);
    }
  }

  await buildAndSwap(client, "pattern_matches", async (tmp) => batchInsert(client, tmp, PM_COLUMNS, collected), log);
  await buildAndSwap(client, "pattern_runs", async (tmp) =>
    batchInsert(
      client,
      tmp,
      ["pattern_id", "match_count", "cap_hit", "duration_ms", "error", "computed_at"],
      Object.entries(runs).map(([id, r]) => [id, r.count, r.capHit, r.ms, r.error ?? null, computedAt]),
    ),
  );
  return runs;
}

/* ─── 3. data-quality scorecard ─────────────────────────────────────── */

async function buildScorecard(client: PoolClient): Promise<Record<string, { count: number | null; dollars: number | null; ms: number; error?: string }>> {
  const results: Record<string, { count: number | null; dollars: number | null; ms: number; error?: string }> = {};
  const rows: unknown[][] = [];
  const computedAt = new Date().toISOString();
  for (const e of DQ_CATALOGUE) {
    const t0 = Date.now();
    let count: number | null = null;
    let dollars: number | null = null;
    let note: string | null = e.notComputable ?? null;
    if (e.sql) {
      try {
        await client.query("BEGIN READ ONLY");
        await client.query("SET LOCAL statement_timeout = '600s'");
        const r = await client.query<{ count: string | number | null; dollars: string | number | null }>(e.sql);
        await client.query("COMMIT");
        count = r.rows[0]?.count == null ? null : Number(r.rows[0].count);
        dollars = r.rows[0]?.dollars == null ? null : Number(r.rows[0].dollars);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        note = `query failed: ${(err as Error).message}`;
        results[e.id] = { count, dollars, ms: Date.now() - t0, error: note };
        log(`✗ dq:${e.id.padEnd(6)} ${note}`);
        continue;
      }
    }
    const ms = Date.now() - t0;
    results[e.id] = { count, dollars, ms };
    log(`✓ dq:${e.id.padEnd(6)} ${(ms / 1000).toFixed(1).padStart(7)}s  count=${count ?? "—"}  dollars=${dollars == null ? "—" : Math.round(dollars).toLocaleString("en-CA")}${note ? `  (${note})` : ""}`);
    rows.push([e.id, e.family, e.title, e.description, count, dollars, e.status, e.guard, Boolean(e.sql), note, computedAt]);
  }
  await buildAndSwap(client, "data_quality_scorecard", async (tmp) =>
    batchInsert(client, tmp, ["issue_id", "family", "title", "description", "count", "dollars", "status", "guard", "computable", "note", "computed_at"], rows),
  );
  return results;
}

/* ─── main ──────────────────────────────────────────────────────────── */

async function main() {
  const url = process.env.DATABASE_URL!;
  log(`Glassbox · refresh-derived → ${describeDb(url)}  steps: ${only.join(", ")}`);
  const pool = adminPool(url);
  const client = await pool.connect();
  const overall = Date.now();
  try {
    await timed("apply migration 001_canonical.sql", () => applyMigration(client), log);

    if (want("canonical")) {
      const ac = await timed("build app.agreement_current", () => buildAgreementCurrent(client), log);
      const roll = await timed("build rollups", () => buildRollups(client), log);
      await setMeta(client, "canonical", { agreement_current: ac.value, ...roll.value, ms: ac.ms + roll.ms });
    }
    if (want("patterns")) {
      _resetFeatureMemoForTest();
      const pm = await timed("build app.pattern_matches", () => buildPatternMatches(client), log);
      await setMeta(client, "patterns", { runs: pm.value, cap: PATTERN_SAFETY_CAP, ms: pm.ms });
    }
    if (want("dq")) {
      const dq = await timed("build app.data_quality_scorecard", () => buildScorecard(client), log);
      await setMeta(client, "dq", { results: dq.value, ms: dq.ms });
    }
    const granted = await grantAppRole(client);
    log(granted ? "✓ GRANT SELECT ON ALL TABLES IN SCHEMA app TO glassbox_app" : "· role glassbox_app not present (local) — no grant");

    const counts = await client.query<{ t: string; n: string }>(
      `SELECT 'agreement_current' t, COUNT(*)::text n FROM app.agreement_current
       UNION ALL SELECT 'recipient_rollup', COUNT(*)::text FROM app.recipient_rollup
       UNION ALL SELECT 'department_rollup', COUNT(*)::text FROM app.department_rollup
       UNION ALL SELECT 'program_rollup', COUNT(*)::text FROM app.program_rollup
       UNION ALL SELECT 'overview_rollup', COUNT(*)::text FROM app.overview_rollup
       UNION ALL SELECT 'fiscal_year_rollup', COUNT(*)::text FROM app.fiscal_year_rollup
       UNION ALL SELECT 'province_rollup', COUNT(*)::text FROM app.province_rollup
       UNION ALL SELECT 'pattern_matches', COUNT(*)::text FROM app.pattern_matches
       UNION ALL SELECT 'pattern_runs', COUNT(*)::text FROM app.pattern_runs
       UNION ALL SELECT 'data_quality_scorecard', COUNT(*)::text FROM app.data_quality_scorecard
       UNION ALL SELECT 'gift_hubs', COUNT(*)::text FROM app.gift_hubs
       UNION ALL SELECT 'gift_loops', COUNT(*)::text FROM app.gift_loops`,
    );
    log("\napp.* row counts:");
    for (const r of counts.rows) log(`  ${r.t.padEnd(24)} ${Number(r.n).toLocaleString("en-CA").padStart(12)}`);
    log(`\nDone in ${((Date.now() - overall) / 1000 / 60).toFixed(1)} min`);
  } finally {
    client.release();
    await pool.end();
    await closePool();
  }
}

main().catch(async (err) => {
  console.error("refresh-derived failed:", err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
