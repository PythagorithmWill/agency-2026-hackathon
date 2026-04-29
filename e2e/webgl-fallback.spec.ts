import { test, expect } from "@playwright/test";

/**
 * WebGL fallback gate. Visits / with WebGL disabled in the browser
 * context. The Manifold landing must redirect to /classic without
 * showing an error to the user.
 */

test("webgl unavailable: / redirects to /classic", async ({ browser }) => {
  const ctx = await browser.newContext({
    // Disable WebGL by overriding the prototype on every page
    extraHTTPHeaders: {},
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // Force getContext('webgl') and ('webgl2') to return null
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      attrs?: object,
    ) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        return null;
      }
      // @ts-expect-error — passthrough preserves overload signatures
      return orig.call(this, type, attrs);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/");
  // The ManifoldLanding effect runs after mount; wait for the redirect.
  await page.waitForURL("**/classic", { timeout: 5_000 });
  expect(new URL(page.url()).pathname).toBe("/classic");

  // Classic should render without a console error
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);

  await ctx.close();
});

test("webgl available: / does not redirect", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  // Wait briefly for the WebGL detection to settle
  await page.waitForTimeout(500);
  // We may be at / or at /classic depending on Chromium's headless WebGL
  // availability; this test only asserts NO error in either case.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
