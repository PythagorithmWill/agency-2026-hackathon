import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { typedRoutes: true },
  env: {
    BUILD_COMMIT: process.env.BUILD_COMMIT ?? "dev",
    BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP ?? new Date().toISOString(),
    PROOF_TOKEN_VERSION: process.env.PROOF_TOKEN_VERSION ?? "1.0",
  },
};

export default nextConfig;
