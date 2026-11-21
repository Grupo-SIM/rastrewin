import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// As imagens já vão otimizadas em public/.
	images: { unoptimized: true },
	output: "standalone",
	outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
	poweredByHeader: false,
	reactStrictMode: true,
};

export default nextConfig;
