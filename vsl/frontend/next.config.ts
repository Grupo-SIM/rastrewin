import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
  poweredByHeader: false,
  reactStrictMode: true,
  // As imagens já vão otimizadas em public/.
  images: { unoptimized: true },
};

export default nextConfig;
