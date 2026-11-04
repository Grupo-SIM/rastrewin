import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/*
 * CSP sem nonce: nonce exige renderização dinâmica e é incompatível com Cache Components/PPR
 * (ver node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md, "Without Nonces").
 * Por isso script-src mantém 'unsafe-inline' (scripts inline do próprio Next). O ganho está no resto:
 * nada de fora carrega, o painel não pode ser embutido em iframe, e formulários e <base> ficam no próprio site.
 * Em dev, o React precisa de 'unsafe-eval' para depurar.
 */
const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Sem upgrade-insecure-requests: o HSTS já força HTTPS em produção, e a diretiva quebraria o teste local em http.
].join("; ");

const nextConfig: NextConfig = {
  // Imagem Docker enxuta: .next/standalone + server.js
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Páginas do painel. /api e /t.js ficam de fora: são JSON e um script que roda NO SITE do cliente.
      {
        source: "/((?!api/|t\\.js$|_next/static/|_next/image/|favicon\\.ico$).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
