import { NextRequest, NextResponse } from "next/server";
import { getDetector } from "@/lib/patterns/detectors";
import { getPattern } from "@/lib/patterns/registry";
import { loadPatternMatches, type PatternMatchRow } from "@/lib/patterns/store";
import type { SignalStrength } from "@/lib/patterns/types";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const MAX_OFFSET = 1_000_000;
const MAX_TEXT = 200;
// Snapshot-backed responses are safe to cache briefly at the edge; live
// table reads are not (they change on every refresh-derived run and the
// caller may be paging through a filtered view).
const CACHE_SNAPSHOT = "public, s-maxage=1800, stale-while-revalidate=86400";
const CACHE_LIVE = "no-store";

/**
 * Legacy `minSignal` (observation | attention | flag) is honoured as a
 * post-filter on the returned page, mapped onto the store's four-band
 * severity: observation → any, attention → medium+, flag → high+.
 * `total` is always the pre-minSignal count so paging stays consistent.
 */
const SEVERITY_RANK: Record<PatternMatchRow["severity"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
const MIN_SIGNAL_RANK: Record<SignalStrength, number> = { observation: 0, attention: 1, flag: 2 };
function toSignal(sev: PatternMatchRow["severity"]): SignalStrength {
  if (sev === "low") return "observation";
  if (sev === "medium") return "attention";
  return "flag";
}

function intParam(raw: string | null, min: number, max: number, dflt: number): number {
  const n = Math.trunc(Number(raw));
  if (raw == null || raw === "" || !Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function textParam(raw: string | null, max = MAX_TEXT): string | undefined {
  if (raw == null) return undefined;
  const s = raw.trim().slice(0, max);
  return s.length > 0 ? s : undefined;
}
function fyParam(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : undefined;
}
function strengthParam(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : undefined;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) {
    return NextResponse.json(
      { error: "unknown_pattern" },
      { status: 404, headers: { "Cache-Control": CACHE_LIVE } },
    );
  }
  const detector = getDetector(slug);
  if (!detector) {
    return NextResponse.json(
      {
        pattern,
        detectorAvailable: false,
        matches: [],
        total: 0,
        message:
          pattern.status === "coming"
            ? "Detector not yet running for this pattern."
            : "Detector implementation pending.",
      },
      { status: 200, headers: { "Cache-Control": CACHE_SNAPSHOT } },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams;
  // Clamp to [1, MAX_LIMIT]; "-5", "0", "abc" and absent all fall back to
  // the default rather than reaching a SQL LIMIT parameter.
  const rawLimit = Math.trunc(Number(q.get("limit")));
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(MAX_LIMIT, rawLimit) : DEFAULT_LIMIT;
  const offset = intParam(q.get("offset"), 0, MAX_OFFSET, 0);
  const department = textParam(q.get("dept") ?? q.get("department"));
  const province = textParam(q.get("prov") ?? q.get("province"), 8);
  const fyFrom = fyParam(q.get("fy") ?? q.get("fyFrom"));
  const minStrength = strengthParam(q.get("strength") ?? q.get("minStrength"));
  const minSignalParam = q.get("minSignal");
  const minSignal: SignalStrength | undefined =
    minSignalParam === "observation" ||
    minSignalParam === "attention" ||
    minSignalParam === "flag"
      ? minSignalParam
      : undefined;

  try {
    const res = await loadPatternMatches({
      patternId: slug,
      limit,
      offset,
      department,
      province,
      fyFrom,
      minStrength,
    });
    const rows = minSignal
      ? res.rows.filter((r) => SEVERITY_RANK[r.severity] >= MIN_SIGNAL_RANK[minSignal])
      : res.rows;
    // `signalStrength` is kept on each row for pre-v2 consumers; the
    // authoritative fields are `severity` and `evidenceStrength`.
    const matches = rows.map((r) => ({ ...r, signalStrength: toSignal(r.severity) }));
    return NextResponse.json(
      {
        pattern,
        detectorAvailable: true,
        source: res.source,
        total: res.total,
        limit,
        offset,
        filters: { department, province, fyFrom, minStrength, minSignal },
        matchCount: matches.length,
        matches,
        computedAt: matches[0]?.computedAt ?? null,
        detectedAt: matches[0]?.computedAt ?? null,
      },
      { headers: { "Cache-Control": res.source === "snapshot" ? CACHE_SNAPSHOT : CACHE_LIVE } },
    );
  } catch (e) {
    // Log the DB-level message server-side; don't echo it to the client.
    console.error(`[api/patterns/${slug}] match read failed:`, (e as Error).message);
    return NextResponse.json(
      { error: "detection_failed", message: "Pattern match read did not complete." },
      { status: 500, headers: { "Cache-Control": CACHE_LIVE } },
    );
  }
}
