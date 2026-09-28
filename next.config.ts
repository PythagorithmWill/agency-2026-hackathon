import type { NextConfig } from "next";

/**
 * Security headers on every response. The Content-Security-Policy allows
 * only this site plus Google Tag Manager / Google Analytics (the only
 * third-party scripts; fonts are self-hosted by next/font). 'unsafe-inline'
 * is required for Next.js's inline bootstrap scripts, the error-swallowing
 * script in app/layout.tsx and the GTM/GA4 loaders; everything else —
 * framing, plugins, base-URI rewriting, cross-site form targets, arbitrary
 * connections — is locked down.
 */
const GOOGLE_TAGS = "https://www.googletagmanager.com https://*.googletagmanager.com";
const GOOGLE_ANALYTICS = "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GOOGLE_TAGS} ${GOOGLE_ANALYTICS}`,
  `connect-src 'self' ${GOOGLE_TAGS} ${GOOGLE_ANALYTICS} https://stats.g.doubleclick.net https://www.google.com`,
  `img-src 'self' data: blob: ${GOOGLE_TAGS} ${GOOGLE_ANALYTICS} https://stats.g.doubleclick.net https://www.google.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://www.googletagmanager.com https://tagassistant.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];


const nextConfig: NextConfig = {
  // unpdf (PDF text extraction) is loaded at runtime from node_modules.
  serverExternalPackages: ["unpdf"],
  /**
   * Disabled because React 19 strict mode double-mounts every component,
   * and Turbopack's reconciler hits a "removeChild on a detached node"
   * race during route transitions when that doubling coincides with a
   * streamed server-component update. Re-enable only after upgrading
   * past the Next 15.5.x + React 19.0 regression.
   */
  reactStrictMode: false,
  poweredByHeader: false,
  output: "standalone",
  experimental: { typedRoutes: true },
  env: {
    BUILD_COMMIT: process.env.BUILD_COMMIT ?? "dev",
    BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP ?? new Date().toISOString(),
    PROOF_TOKEN_VERSION: process.env.PROOF_TOKEN_VERSION ?? "1.0",
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
