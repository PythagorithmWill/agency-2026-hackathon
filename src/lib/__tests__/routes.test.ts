import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Route-existence gate. Walks every src/app/**\/page.tsx file, builds the
 * set of routes Next.js exposes, then walks every src/**\/*.{ts,tsx}
 * file looking for href values and asserts each one resolves to an
 * existing route or external URL.
 *
 * The two 404s that shipped in v1 (Adjust Weights, Download Token JSON)
 * cannot recur if this gate stays green.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const APP_DIR = path.join(PROJECT_ROOT, "src/app");
const SRC_DIR = path.join(PROJECT_ROOT, "src");

async function walkFiles(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "__tests__") continue;
      out.push(...(await walkFiles(p, exts)));
    } else if (exts.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}

function toRoutePattern(absPagePath: string, suffix: string): string {
  // Route groups — "(list)" segments — organise files without affecting
  // the URL, so strip them before building the pattern.
  const rel = absPagePath
    .slice(APP_DIR.length)
    .replace(suffix, "")
    .replace(/\/\([^/]+\)/g, "");
  return rel === "" ? "/" : rel;
}

function patternToRegex(pattern: string): RegExp {
  if (pattern === "/") return /^\/$/;
  const escaped = pattern
    .replace(/\[\.\.\.[^\]]+\]/g, "(.+)")
    .replace(/\[[^\]]+\]/g, "([^/]+)");
  return new RegExp(`^${escaped}$`);
}

const KNOWN_EXTERNAL_PREFIXES = [
  "http://",
  "https://",
  "mailto:",
  "tel:",
  "#",
];

async function loadAppRoutes(): Promise<RegExp[]> {
  const pages = await walkFiles(APP_DIR, ["page.tsx"]);
  const apis = await walkFiles(APP_DIR, ["route.ts"]);
  const patterns = [
    ...pages.map((p) => toRoutePattern(p, "/page.tsx")),
    ...apis.map((p) => toRoutePattern(p, "/route.ts")),
  ];
  return patterns.map(patternToRegex);
}

// Matches JSX `href="/x"`, `href={"/x"}`, `href={`/x/${id}`}` AND object
// literal `href: "/x"` (the recommendations link arrays in src/lib).
const HREF_RE = /href\s*(?:=\s*\{?|:)\s*[`"']([^`"'\s]+)/g;

/**
 * Template-literal hrefs have each `${…}` interpolation replaced by a
 * placeholder segment, so `/api/proof/${id}/download` is checked as
 * `/api/proof/x/download`. Previously every `${…}` href was skipped,
 * which is exactly where an `as never` cast can hide a dead route.
 * Nested braces inside an interpolation can't be parsed by regex; those
 * (rare) hrefs are skipped rather than mis-reported.
 */
function normaliseTemplateHref(raw: string): string | null {
  if (!raw.includes("${")) return raw;
  const replaced = raw.replace(/\$\{[^{}]*\}/g, "x");
  if (replaced.includes("${")) return null;
  return replaced;
}

async function extractInternalHrefs(): Promise<{ href: string; file: string }[]> {
  const files = await walkFiles(SRC_DIR, [".tsx", ".ts"]);
  const out: { href: string; file: string }[] = [];
  for (const f of files) {
    if (f.includes("__tests__")) continue;
    const content = await fs.readFile(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = HREF_RE.exec(content))) {
      const raw = normaliseTemplateHref(m[1] ?? "");
      if (!raw) continue;
      out.push({ href: raw, file: path.relative(PROJECT_ROOT, f) });
    }
  }
  return out;
}

function isExternal(href: string): boolean {
  return KNOWN_EXTERNAL_PREFIXES.some((p) => href.startsWith(p));
}

describe("route existence gate", () => {
  it("every internal href points to a route file that exists", async () => {
    const patterns = await loadAppRoutes();
    const hrefs = await extractInternalHrefs();
    const unmatched: { href: string; file: string }[] = [];

    for (const { href, file } of hrefs) {
      if (isExternal(href)) continue;
      const path = href.split(/[?#]/)[0];
      if (!path.startsWith("/")) continue;
      const matched = patterns.some((re) => re.test(path));
      if (!matched) unmatched.push({ href: path, file });
    }

    if (unmatched.length > 0) {
      console.error("Unmatched hrefs:");
      for (const u of unmatched) console.error(`  ${u.href}  (in ${u.file})`);
    }
    expect(unmatched).toEqual([]);
  });

  it("the four critical routes exist", async () => {
    const patterns = await loadAppRoutes();
    const expected = [
      "/",
      "/evaluate",
      "/evaluate/some-id",
      "/methodology",
      "/verify/some-id",
      "/api/draft/evaluate",
      "/api/proof/some-id/download",
    ];
    for (const e of expected) {
      const matched = patterns.some((re) => re.test(e));
      expect(matched, `route ${e} should match an existing pattern`).toBe(true);
    }
  });
});
