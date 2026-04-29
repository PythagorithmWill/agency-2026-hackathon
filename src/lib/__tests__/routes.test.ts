import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Route-existence gate. Walks every src/app/**\/page.tsx file, builds the
 * set of routes Next.js exposes, then walks every src/**\/*.{ts,tsx}
 * file looking for href values and asserts each one resolves to an
 * existing route or external URL. The two 404s that shipped in v1
 * (Adjust Weights, Download Token JSON) cannot recur if this gate stays
 * green.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const APP_DIR = path.join(PROJECT_ROOT, "src/app");
const SRC_DIR = path.join(PROJECT_ROOT, "src");

async function walkFiles(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      out.push(...(await walkFiles(p, exts)));
    } else if (exts.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}

/** Convert a src/app/.../page.tsx path → route pattern like /classic/outcome/[slug] */
function toRoutePattern(absPagePath: string): string {
  const rel = absPagePath.slice(APP_DIR.length).replace(/\/page\.tsx$/, "") || "/";
  return rel === "" ? "/" : rel;
}

/** Convert a route pattern with [slug] params into a regex matching concrete URLs */
function patternToRegex(pattern: string): RegExp {
  if (pattern === "/") return /^\/$/;
  const escaped = pattern
    .replace(/\[\.\.\.[^\]]+\]/g, "(.+)") // catch-all
    .replace(/\[[^\]]+\]/g, "([^/]+)"); // dynamic segment
  return new RegExp(`^${escaped}$`);
}

const KNOWN_EXTERNAL_PREFIXES = [
  "http://",
  "https://",
  "mailto:",
  "tel:",
  "#",
  "/api/", // API routes are not in the page-route set; covered separately
];

const EXTRA_API_ROUTES = [
  "/api/brief",
  "/api/proof/[proofId]/download",
];

async function loadAppRoutes(): Promise<RegExp[]> {
  const pages = await walkFiles(APP_DIR, ["page.tsx"]);
  const apiRoutes = await walkFiles(APP_DIR, ["route.ts"]);
  const patterns = pages
    .map(toRoutePattern)
    .concat(EXTRA_API_ROUTES)
    .concat(apiRoutes.map((p) => p.slice(APP_DIR.length).replace(/\/route\.ts$/, "")));
  return patterns.map(patternToRegex);
}

const HREF_RE = /href=(?:\{[`"']|["'])([^`"'\s}]+)/g;

async function extractInternalHrefs(): Promise<{ href: string; file: string }[]> {
  const files = await walkFiles(SRC_DIR, [".tsx", ".ts"]);
  const out: { href: string; file: string }[] = [];
  for (const f of files) {
    if (f.includes("__tests__")) continue;
    const content = await fs.readFile(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = HREF_RE.exec(content))) {
      const raw = m[1];
      // Skip template-string interpolations like `${slug}` — we can't
      // statically resolve those. Skip empty hrefs, fragment-only refs.
      if (!raw || raw.includes("${")) continue;
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
      // Strip query string and hash for route matching
      const path = href.split(/[?#]/)[0];
      if (!path.startsWith("/")) continue;
      const matched = patterns.some((re) => re.test(path));
      if (!matched) unmatched.push({ href: path, file });
    }

    if (unmatched.length > 0) {
      console.error("Unmatched hrefs:");
      for (const u of unmatched) {
        console.error(`  ${u.href}  (in ${u.file})`);
      }
    }
    expect(unmatched).toEqual([]);
  });

  it("the four critical routes exist", async () => {
    const patterns = await loadAppRoutes();
    const expected = [
      "/",
      "/classic",
      "/proof/rerun/some-id",
      "/proof/some-id",
    ];
    for (const e of expected) {
      const matched = patterns.some((re) => re.test(e));
      expect(matched, `route ${e} should match an existing pattern`).toBe(true);
    }
  });
});
