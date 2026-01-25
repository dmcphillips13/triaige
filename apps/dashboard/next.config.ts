import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile shared workspace packages
  transpilePackages: ["@triaige/shared"],
};

export default nextConfig;
