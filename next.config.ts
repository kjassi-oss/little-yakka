import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Reuse client-side router cache briefly so bottom-tab navigation feels
    // instant; RealtimeRefresh still re-fetches the moment data changes.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
