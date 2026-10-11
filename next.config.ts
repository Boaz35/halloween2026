import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and dynamic; we rely on classic dynamic rendering
  // instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    authInterrupts: true,
  },
};

export default nextConfig;
