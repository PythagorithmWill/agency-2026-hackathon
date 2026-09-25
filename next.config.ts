import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs must stay external: Turbopack cannot resolve pdfjs's
  // worker chunk and the bundled copy pulls a native canvas binding.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // The extract route hands pdfjs its worker as a data: URL read from this
  // file at runtime; it is not statically imported, so trace it explicitly
  // or the standalone bundle (what Amplify deploys) lacks it → PDFs 422.
  outputFileTracingIncludes: {
    "/api/draft/extract": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"],
  },
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
};

export default nextConfig;
