import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
