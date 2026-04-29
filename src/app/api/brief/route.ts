import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { OutcomeBrief } from "@/lib/types";

/**
 * GET /api/brief?name=...
 *
 * Best-effort lookup of a cached brief by the subject's canonical name
 * (case-insensitive, ignoring punctuation). Returns 404 if no brief is
 * cached for that subject — caller is responsible for falling back to
 * the live synthesis pipeline.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "missing name" }, { status: 400 });
  }
  const norm = normalize(name);
  const briefsDir = path.join(process.cwd(), "src/data/briefs");
  let files: string[] = [];
  try {
    files = await fs.readdir(briefsDir);
  } catch {
    return NextResponse.json({ error: "no briefs dir" }, { status: 500 });
  }
  for (const f of files.filter((f) => f.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(briefsDir, f), "utf8");
    const brief = JSON.parse(raw) as OutcomeBrief;
    if (normalize(brief.subject.canonicalName) === norm) {
      return NextResponse.json(brief);
    }
  }
  return NextResponse.json({ error: "not found", name }, { status: 404 });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
