#!/usr/bin/env tsx
/**
 * Hub-aware CRA gift loops → app.gift_hubs + app.gift_loops.
 *
 * Usage:
 *   DATABASE_URL=postgresql://localhost:5432/agency26 npx tsx scripts/refresh-loops.ts
 *
 * Graph: one directed edge per (donor bn, donee_bn, donor fiscal-period
 * end) from cra.cra_qualified_donees, gifts summed, kept when ≥ $5,000
 * and both BNs are well-formed 15-char CRA BNs (C-3/C-4 guard).
 *
 * Hubs: nodes with (distinct in + distinct out) degree ≥ 50 OR whose
 * name matches donor-advised / foundation / federated / diocese /
 * conference / council patterns. A hub may be the ORIGIN of a loop
 * (reported as hub_touched) but is never traversed as an intermediary.
 *
 * Loops: simple cycles of 2–4 hops. Hop fiscal periods are
 * non-decreasing and the whole loop spans ≤ 12 months (start fpe to end
 * fpe). Edge weight = gift ÷ donor's total qualified-donee gifts in that
 * fiscal period. Score = min edge weight × hops penalty (2: 1.0, 3: 0.8,
 * 4: 0.6). Cycles are de-duplicated on their edge set.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (e.g. postgresql://localhost:5432/agency26)");
  process.exit(2);
}

import type { PoolClient } from "pg";
import { adminPool, applyMigration, buildAndSwap, batchInsert, setMeta, grantAppRole, describeDb, timed } from "../src/lib/db/refresh";
import { THRESHOLDS } from "../src/lib/patterns/registry";

const GIFT_FLOOR = THRESHOLDS.LOOP_GIFT_FLOOR;
const MAX_HOPS = THRESHOLDS.LOOP_MAX_HOPS;
const SPAN_DAYS = Math.round((THRESHOLDS.LOOP_SPAN_MONTHS / 12) * 365.25);
const HUB_DEGREE = THRESHOLDS.LOOP_HUB_DEGREE;
const HOP_PENALTY: Record<number, number> = { 2: 1.0, 3: 0.8, 4: 0.6 };
const PER_ORIGIN_CAP = 2_000;
const GLOBAL_CAP = 500_000;
const HUB_NAME_RE = /donor.?advised|foundation|fondation|federat|f[ée]d[ée]ration|diocese|dioc[èe]se|conference|conf[ée]rence|council|conseil|united way|centraide/i;

const log = (m: string) => console.log(m);

interface Edge { to: number; fpe: number; amount: number; weight: number; fpeIso: string }

async function main() {
  const url = process.env.DATABASE_URL!;
  log(`Glassbox · refresh-loops → ${describeDb(url)}`);
  const pool = adminPool(url);
  const client = await pool.connect();
  const overall = Date.now();
  try {
    await timed("apply migration 001_canonical.sql", () => applyMigration(client), log);

    // ── edges ─────────────────────────────────────────────────────────
    const edgesQ = await timed("load gift edges ≥ $5K", () =>
      client.query<{ bn: string; donee_bn: string; fpe: string; amount: string; donor_total: string }>(
        `WITH gifts AS (
           SELECT bn, donee_bn, fpe, SUM(total_gifts) AS amount
             FROM cra.cra_qualified_donees
            WHERE total_gifts > 0
              AND bn ~ '^[0-9]{9}RR[0-9]{4}$'
              AND donee_bn ~ '^[0-9]{9}RR[0-9]{4}$'
              AND donee_bn <> bn
            GROUP BY bn, donee_bn, fpe
         ),
         donor_year AS (
           SELECT bn, fpe, SUM(total_gifts) AS donor_total
             FROM cra.cra_qualified_donees
            WHERE total_gifts > 0 AND bn ~ '^[0-9]{9}RR[0-9]{4}$'
            GROUP BY bn, fpe
         )
         SELECT g.bn, g.donee_bn, g.fpe::text AS fpe, g.amount::text, d.donor_total::text
           FROM gifts g JOIN donor_year d USING (bn, fpe)
          WHERE g.amount >= $1`,
        [GIFT_FLOOR],
      ), log);
    const raw = edgesQ.value.rows;
    log(`  ${raw.length.toLocaleString("en-CA")} edges`);

    // ── node index ───────────────────────────────────────────────────
    const idOf = new Map<string, number>();
    const bnOf: string[] = [];
    const nid = (bn: string) => {
      let i = idOf.get(bn);
      if (i === undefined) { i = bnOf.length; idOf.set(bn, i); bnOf.push(bn); }
      return i;
    };
    const out: Edge[][] = [];
    const inNbrs: Set<number>[] = [];
    const outNbrs: Set<number>[] = [];
    const ensure = (i: number) => { while (out.length <= i) { out.push([]); inNbrs.push(new Set()); outNbrs.push(new Set()); } };
    for (const r of raw) {
      const a = nid(r.bn), b = nid(r.donee_bn);
      ensure(Math.max(a, b));
      const amount = Number(r.amount), donorTotal = Number(r.donor_total);
      const fpe = Date.parse(r.fpe);
      out[a].push({ to: b, fpe, amount, weight: donorTotal > 0 ? amount / donorTotal : 0, fpeIso: r.fpe.slice(0, 10) });
      outNbrs[a].add(b); inNbrs[b].add(a);
    }
    for (const list of out) list.sort((x, y) => x.fpe - y.fpe);
    const n = bnOf.length;
    log(`  ${n.toLocaleString("en-CA")} nodes`);

    // ── names ────────────────────────────────────────────────────────
    const namesQ = await timed("load charity names", () =>
      client.query<{ bn: string; legal_name: string }>(
        `SELECT DISTINCT ON (bn) bn, legal_name FROM cra.cra_identification WHERE bn = ANY($1) ORDER BY bn, fiscal_year DESC`,
        [bnOf],
      ), log);
    const nameOf = new Map<string, string>(namesQ.value.rows.map((r) => [r.bn, r.legal_name]));
    const missing = bnOf.filter((b) => !nameOf.has(b));
    if (missing.length > 0) {
      const dn = await client.query<{ donee_bn: string; donee_name: string }>(
        `SELECT DISTINCT ON (donee_bn) donee_bn, donee_name FROM cra.cra_qualified_donees
          WHERE donee_bn = ANY($1) AND donee_name IS NOT NULL ORDER BY donee_bn, total_gifts DESC NULLS LAST`,
        [missing],
      );
      for (const r of dn.rows) nameOf.set(r.donee_bn, r.donee_name);
      log(`  ${missing.length.toLocaleString("en-CA")} nodes not in cra_identification (C-11); ${dn.rows.length.toLocaleString("en-CA")} named from donor-written donee_name`);
    }

    // ── hubs ─────────────────────────────────────────────────────────
    const isHub = new Uint8Array(n);
    const hubRows: unknown[][] = [];
    let byDegree = 0, byName = 0;
    for (let i = 0; i < n; i++) {
      const deg = inNbrs[i].size + outNbrs[i].size;
      const name = nameOf.get(bnOf[i]) ?? "";
      const d = deg >= HUB_DEGREE, m = HUB_NAME_RE.test(name);
      if (d || m) {
        isHub[i] = 1;
        if (d) byDegree++;
        if (m) byName++;
        hubRows.push([bnOf[i], name || null, inNbrs[i].size, outNbrs[i].size, d && m ? "degree+name" : d ? "degree" : "name"]);
      }
    }
    log(`  hubs: ${hubRows.length.toLocaleString("en-CA")} (degree ≥ ${HUB_DEGREE}: ${byDegree}; name pattern: ${byName})`);

    // ── cycle enumeration ────────────────────────────────────────────
    const t0 = Date.now();
    const seen = new Set<string>();
    const loops: unknown[][] = [];
    let perOriginCapHits = 0, globalCapHit = false, loopId = 0;
    const spanMs = SPAN_DAYS * 86_400_000;
    const path: number[] = [];
    const pathEdges: Edge[] = [];
    const onPath = new Uint8Array(n);

    function record(origin: number) {
      const key = pathEdges.map((e, k) => `${path[k]}>${e.to}@${e.fpe}`).sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      const hops = pathEdges.length;
      const minW = Math.min(...pathEdges.map((e) => e.weight));
      const hubs = path.filter((v) => isHub[v]).map((v) => bnOf[v]);
      const start = pathEdges[0].fpe, end = pathEdges[hops - 1].fpe;
      loops.push([
        ++loopId, hops,
        path.map((v) => bnOf[v]), path.map((v) => nameOf.get(bnOf[v]) ?? bnOf[v]),
        pathEdges.map((e) => e.fpeIso), pathEdges.map((e) => e.amount), pathEdges.map((e) => Number(e.weight.toFixed(6))),
        Number(minW.toFixed(6)), Number((minW * (HOP_PENALTY[hops] ?? 0.5)).toFixed(6)),
        pathEdges.reduce((s, e) => s + e.amount, 0), Math.min(...pathEdges.map((e) => e.amount)),
        hubs.length > 0, hubs,
        pathEdges[0].fpeIso, pathEdges[hops - 1].fpeIso, Math.round((end - start) / 86_400_000),
      ]);
      void origin;
      return true;
    }

    let originCount = 0;
    for (let origin = 0; origin < n && !globalCapHit; origin++) {
      if (out[origin].length === 0 || inNbrs[origin].size === 0) continue;
      originCount++;
      let found = 0;
      path.length = 0; pathEdges.length = 0; onPath.fill(0);
      path.push(origin); onPath[origin] = 1;
      const dfs = (cur: number, prevFpe: number, deadline: number, depth: number): void => {
        if (found >= PER_ORIGIN_CAP || loops.length >= GLOBAL_CAP) return;
        for (const e of out[cur]) {
          if (e.fpe < prevFpe) continue;
          if (e.fpe > deadline) break; // edges are sorted by fpe
          if (e.to === origin) {
            if (depth >= 2) { pathEdges.push(e); if (record(origin)) found++; pathEdges.pop(); }
            continue;
          }
          if (depth >= MAX_HOPS) continue;
          if (onPath[e.to] || isHub[e.to] || out[e.to].length === 0) continue;
          path.push(e.to); pathEdges.push(e); onPath[e.to] = 1;
          dfs(e.to, e.fpe, deadline, depth + 1);
          path.pop(); pathEdges.pop(); onPath[e.to] = 0;
          if (found >= PER_ORIGIN_CAP || loops.length >= GLOBAL_CAP) return;
        }
      };
      // depth = number of edges taken so far + 1 (next edge index)
      for (const first of out[origin]) {
        if (found >= PER_ORIGIN_CAP) break;
        if (onPath[first.to] || isHub[first.to] || out[first.to].length === 0) continue;
        path.push(first.to); pathEdges.push(first); onPath[first.to] = 1;
        dfs(first.to, first.fpe, first.fpe + spanMs, 2);
        path.pop(); pathEdges.pop(); onPath[first.to] = 0;
      }
      if (found >= PER_ORIGIN_CAP) perOriginCapHits++;
      if (loops.length >= GLOBAL_CAP) globalCapHit = true;
      if (originCount % 5000 === 0) log(`  … ${originCount.toLocaleString("en-CA")} origins, ${loops.length.toLocaleString("en-CA")} loops, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    const enumMs = Date.now() - t0;
    const byHops: Record<number, number> = {};
    let hubTouched = 0;
    for (const l of loops) { byHops[l[1] as number] = (byHops[l[1] as number] ?? 0) + 1; if (l[11]) hubTouched++; }
    log(`✓ enumerate cycles ≤ ${MAX_HOPS} hops                 ${(enumMs / 1000).toFixed(1).padStart(8)}s  ${loops.length.toLocaleString("en-CA")} loops (${Object.entries(byHops).map(([h, c]) => `${h}-hop ${c}`).join(", ")}); hub_touched ${hubTouched}; origins ${originCount}; per-origin cap hits ${perOriginCapHits}${globalCapHit ? "; GLOBAL CAP HIT" : ""}`);

    // ── write ────────────────────────────────────────────────────────
    await timed("write app.gift_hubs", () =>
      buildAndSwap(client, "gift_hubs", async (tmp) =>
        batchInsert(client, tmp, ["bn", "legal_name", "in_degree", "out_degree", "reason"], hubRows), log), log);
    await timed("write app.gift_loops", () =>
      buildAndSwap(client, "gift_loops", async (tmp) =>
        batchInsert(client, tmp, [
          "loop_id", "hops", "path_bns", "path_names", "path_fpes", "path_amounts", "edge_weights",
          "min_edge_weight", "score", "total_amount", "min_amount", "hub_touched", "hub_bns", "start_fpe", "end_fpe", "span_days",
        ], loops), log), log);
    await setMeta(client, "loops", {
      edges: raw.length, nodes: n, hubs: hubRows.length, hubs_by_degree: byDegree, hubs_by_name: byName,
      loops: loops.length, by_hops: byHops, hub_touched: hubTouched, origins: originCount,
      per_origin_cap: PER_ORIGIN_CAP, per_origin_cap_hits: perOriginCapHits, global_cap_hit: globalCapHit,
      enumerate_ms: enumMs, total_ms: Date.now() - overall,
    });
    const granted = await grantAppRole(client);
    log(granted ? "✓ GRANT SELECT ON ALL TABLES IN SCHEMA app TO glassbox_app" : "· role glassbox_app not present (local) — no grant");
    log(`\nDone in ${((Date.now() - overall) / 1000 / 60).toFixed(1)} min`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("refresh-loops failed:", err);
  process.exit(1);
});
