import path from "node:path";
import type { NextConfig } from "next";

/** Capa com versão no nome (`/poster-v2.webp`): pode ficar guardada no navegador por 1 ano. */
const POSTER_PATH = "/:poster(poster-v\\d+\\.(?:webp|avif|jpg|png))";

const nextConfig: NextConfig = {
	// Para trocar a capa, use um nome novo (ex.: poster-v3.webp): o Zod do page-config exige a versão.
	headers: async () => [
		{
			headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
			source: POSTER_PATH,
		},
	],
	// As imagens já vão otimizadas em public/.
	images: { unoptimized: true },
	output: "standalone",
	outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
	poweredByHeader: false,
	reactStrictMode: true,
};

export default nextConfig;
