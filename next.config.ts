import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Letterpad is a fully authenticated, per-user dynamic app (session + DB on
   * every dashboard request). Cache Components would only add Suspense
   * bookkeeping, so it stays off.
   */
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
