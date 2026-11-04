import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MarketMind lives in a sub-folder of a repo that has its own lockfile; pin the root here.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
