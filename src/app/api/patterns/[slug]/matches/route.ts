import { NextRequest, NextResponse } from "next/server";
import { getDetector } from "@/lib/patterns/detectors";
import { getPattern } from "@/lib/patterns/registry";
import type { SignalStrength } from "@/lib/patterns/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) {
    return NextResponse.json({ error: "unknown_pattern" }, { status: 404 });
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
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit")) || 50);
  const minSignalParam = url.searchParams.get("minSignal");
  const minSignal: SignalStrength | undefined =
    minSignalParam === "observation" ||
    minSignalParam === "attention" ||
    minSignalParam === "flag"
      ? minSignalParam
      : undefined;

  try {
    const matches = await detector.detect({ limit, minSignal });
    return NextResponse.json({
      pattern,
      detectorAvailable: true,
      matchCount: matches.length,
      matches,
      detectedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "detection_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}
