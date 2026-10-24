import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Site 100% estático: gera HTML/CSS/JS em out/, servidos pelo Caddy (sem servidor Node).
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
  // O export estático não tem o otimizador de imagens; as imagens já vão otimizadas em public/.
  images: { unoptimized: true },
};

export default nextConfig;
