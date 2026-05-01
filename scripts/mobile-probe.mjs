// One-off mobile-responsiveness probe.
// Loads each route at three viewport widths (320/390/768) and reports:
//   - any route that returns a non-2xx status
//   - any route whose <html> scrollWidth > viewport width (horizontal overflow)
//   - any element wider than the viewport at the body level
//
// Usage: node scripts/mobile-probe.mjs (dev server must be on :3000)

import { chromium } from "playwright";

const ROUTES = [
  "/",
  "/search",
  "/search?q=housing",
  "/evaluate",
  "/follow",
  "/follow/funding-loops",
  "/transparency",
  "/transparency/departments",
  "/transparency/recipients",
  "/methodology",
  "/compliance",
  "/recommendations",
  "/trace",
];

const VIEWPORTS = [
  { name: "iPhone SE", width: 320, height: 568 },
  { name: "iPhone 13", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Desktop", width: 1440, height: 900 },
];

async function probe() {
  const browser = await chromium.launch();
  const issues = [];
  let passed = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width < 700 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" : undefined,
    });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`${e.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
      });
      let resp;
      try {
        resp = await page.goto(`http://localhost:3000${route}`, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
      } catch (e) {
        issues.push({ vp: vp.name, route, kind: "navigation", detail: e.message });
        await page.close();
        continue;
      }
      const status = resp?.status() ?? 0;
      if (status >= 400) {
        issues.push({ vp: vp.name, route, kind: "http", detail: status });
      }
      // Horizontal-overflow check (the canonical "is it broken on mobile" signal).
      const overflow = await page.evaluate((vw) => {
        const html = document.documentElement;
        const body = document.body;
        const scroll = Math.max(html.scrollWidth, body.scrollWidth);
        const wide = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > vw + 1) {
            wide.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 80),
              w: Math.round(r.width),
            });
            if (wide.length >= 3) break;
          }
        }
        return { scroll, vw, wide };
      }, vp.width);
      if (overflow.scroll > vp.width + 1) {
        issues.push({
          vp: vp.name,
          route,
          kind: "page-overflow",
          detail: `scrollWidth ${overflow.scroll} > viewport ${vp.width}`,
          wide: overflow.wide,
        });
      }
      if (errors.length) {
        issues.push({
          vp: vp.name,
          route,
          kind: "js-error",
          detail: errors.slice(0, 2).join(" | "),
        });
      }
      passed += 1;
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nProbed ${passed} (route × viewport) pairs.`);
  if (issues.length === 0) {
    console.log("✓ no overflow / no error issues at any width");
    return;
  }
  console.log(`\n✗ ${issues.length} issue(s):\n`);
  for (const i of issues) {
    console.log(`  [${i.vp}] ${i.route}  ${i.kind}: ${i.detail}`);
    if (i.wide?.length) {
      for (const w of i.wide) {
        console.log(`        wide ${w.w}px  <${w.tag}> ${w.cls}`);
      }
    }
  }
  process.exitCode = 1;
}

probe().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
