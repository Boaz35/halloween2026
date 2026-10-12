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
    // Vercel caps request bodies at 4.5 MB; covers are limited to 4 MB (+ form fields).
    serverActions: { bodySizeLimit: "4.5mb" },
    authInterrupts: true,
  },
};

export default nextConfig;
