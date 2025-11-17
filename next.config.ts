import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure amplify_outputs.json is included in the build
  serverExternalPackages: [],
};

export default nextConfig;
