import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-mode overlay badge so the local demo reads clean.
  devIndicators: false,

  // The workspace/dashboard routes read data/cleaned_accounts.json from disk at
  // request time (via a dynamic path), which Next's tracer can't detect on its
  // own. Explicitly include it so the file ships in the serverless bundle on
  // Vercel — otherwise those routes 500 with "file not found".
  outputFileTracingIncludes: {
    "/workspace": ["./data/**"],
    "/dashboard": ["./data/**"],
  },
};

export default nextConfig;
