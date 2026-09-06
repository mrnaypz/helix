import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@nktkas/hyperliquid", "viem"],
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "napier.tailcbe4f6.ts.net",
    "100.98.58.62",
  ],
};

export default nextConfig;
