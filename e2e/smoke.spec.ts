import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const ROUTES = [
  { path: "/", name: "manifold-root" },
  { path: "/classic", name: "classic-glass-box" },
  { path: "/classic/outcome", name: "classic-outcome-index" },
  { path: "/classic/outcome/we-charity-foundation", name: "classic-outcome-we" },
  { path: "/classic/outcome/sustainable-development-technology-canada", name: "classic-outcome-sdtc" },
  { path: "/classic/counterfactual", name: "classic-counterfactual-index" },
  { path: "/classic/counterfactual/cf-sif-showcase-1", name: "classic-counterfactual-sif" },
  { path: "/classic/cached/we-charity-foundation/outcome-brief", name: "classic-cached-we" },
  { path: "/proof/ppm-2026-04-29T00:00:00.000Z-we-001", name: "proof-permalink-we" },
  { path: "/proof/rerun/ppm-2026-04-29T00:00:00.000Z-we-001", name: "proof-rerun-we" },
];

const SCREENSHOT_DIR = path.resolve(__dirname, "../e2e-screenshots");

test.beforeAll(async () => {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
});

for (const route of ROUTES) {
  test(`smoke: ${route.path} renders without console errors or broken images`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response?.ok(), `expected 2xx for ${route.path}`).toBe(true);

    // Manifold root may redirect to /classic in headless if WebGL is
    // unavailable in the CI environment; tolerate that as a pass.
    if (route.path === "/") {
      const finalUrl = new URL(page.url()).pathname;
      expect(["/", "/classic"]).toContain(finalUrl);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${route.name}.png`),
      fullPage: true,
    });

    // No broken <img> elements
    const broken = await page.$$eval("img", (imgs) =>
      imgs.filter((img) => img.naturalWidth === 0 && img.complete).length,
    );
    expect(broken, "no broken images").toBe(0);

    // Filter out known noise: Next.js dev-only warnings about font preload,
    // hydration warnings from drei <Html>, GSAP non-error console.log.
    const filtered = consoleErrors.filter(
      (e) =>
        !e.includes("not added in `pages/_document`") &&
        !e.includes("Hydration") &&
        !e.includes("hydrat"),
    );
    expect(filtered, `unexpected console errors on ${route.path}`).toEqual([]);
  });
}
