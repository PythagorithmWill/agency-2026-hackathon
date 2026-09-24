import { NextRequest, NextResponse } from "next/server";
import { getDetector } from "@/lib/patterns/detectors";
import { getPattern } from "@/lib/patterns/registry";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import type { PatternMatch, SignalStrength } from "@/lib/patterns/types";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const SIGNAL_RANK: Record<SignalStrength, number> = { observation: 0, attention: 1, flag: 2 };
// Snapshot-backed responses are safe to cache briefly at the edge; live
// runs are not (they depend on DB availability at request time).
const CACHE_SNAPSHOT = "public, s-maxage=1800, stale-while-revalidate=86400";
const CACHE_LIVE = "no-store";

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
        message:
          pattern.status === "coming"
            ? "Detector not yet running for this pattern."
            : "Detector implementation pending.",
      },
      { status: 200, headers: { "Cache-Control": CACHE_SNAPSHOT } },
    );
  }

  const url = new URL(req.url);
  // Clamp to [1, MAX_LIMIT]; "-5", "0", "abc" and absent all fall back to
  // the default rather than reaching a SQL LIMIT parameter.
  const rawLimit = Math.trunc(Number(url.searchParams.get("limit")));
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(MAX_LIMIT, rawLimit) : DEFAULT_LIMIT;
  const minSignalParam = url.searchParams.get("minSignal");
  const minSignal: SignalStrength | undefined =
    minSignalParam === "observation" ||
    minSignalParam === "attention" ||
    minSignalParam === "flag"
      ? minSignalParam
      : undefined;

  // Snapshot-first, mirroring /follow/[slug]: the precomputed matches are
  // served without touching the DB. A live detector run on every request
  // took 15-45s locally and exceeds the 30s edge timeout in production
  // (observed HTTP 504), so it is only the fallback when the snapshot has
  // nothing for this pattern.
  const snap = await loadSnapshot();
  const cached = snap?.patternMatches?.[slug] as PatternMatch[] | undefined;
  if (cached && cached.length > 0) {
    const filtered = minSignal
      ? cached.filter((m) => SIGNAL_RANK[m.signalStrength] >= SIGNAL_RANK[minSignal])
      : cached;
    const matches = filtered.slice(0, limit);
    return NextResponse.json(
      {
        pattern,
        detectorAvailable: true,
        source: "snapshot",
        matchCount: matches.length,
        matches,
        detectedAt: matches[0]?.detectedAt ?? snap?.generatedAt ?? null,
      },
      { headers: { "Cache-Control": CACHE_SNAPSHOT } },
    );
  }
  const cachedError = snap?.patternMatchErrors?.[slug];
  if (cachedError) {
    return NextResponse.json(
      {
        pattern,
        detectorAvailable: true,
        source: "snapshot",
        matchCount: 0,
        matches: [],
        error: "detection_failed",
        message: "The last precompute run for this pattern did not complete.",
      },
      { status: 503, headers: { "Cache-Control": CACHE_LIVE } },
    );
  }

  try {
    const matches = await detector.detect({ limit, minSignal });
    return NextResponse.json(
      {
        pattern,
        detectorAvailable: true,
        source: "live",
        matchCount: matches.length,
        matches,
        detectedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": CACHE_LIVE } },
    );
  } catch (e) {
    // Log the DB-level message server-side; don't echo it to the client.
    console.error(`[api/patterns/${slug}] detection failed:`, (e as Error).message);
    return NextResponse.json(
      { error: "detection_failed", message: "Pattern detection did not complete." },
      { status: 500, headers: { "Cache-Control": CACHE_LIVE } },
    );
  }
}
