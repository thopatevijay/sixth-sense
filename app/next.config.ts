import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this package (the monorepo root also has a lockfile).
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
