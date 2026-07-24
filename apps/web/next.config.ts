import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS source (no build step yet) — Next must
  // transpile them itself rather than expect pre-built JS.
  transpilePackages: [
    "@protego/ui",
    "@protego/config",
    "@protego/domain",
    "@protego/validation",
    "@protego/supabase",
  ],
};

export default nextConfig;
