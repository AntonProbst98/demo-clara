import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-mode overlay badge so the local demo reads clean.
  devIndicators: false,
};

export default nextConfig;
