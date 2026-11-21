// Em dev, o front chama /api/* e o Next repassa para a API local (rewrite resolvido em
// build time). Em produção o front chama NEXT_PUBLIC_API_URL direto (ver lib/api.ts),
// já que o rewrite não pode variar por ambiente num build standalone. Por isso o rewrite só
// existe quando NEXT_PUBLIC_API_URL não é uma URL completa: no build de produção ele
// apontaria para o localhost do container e todo rastrewin.com/api/* responderia 500.
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_TARGET = process.env.API_INTERNAL_URL ?? "http://localhost:3011";

/** Origem de uma URL (ou null se não for uma URL válida, como o "/api" do dev). */
const originOf = value => {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
};
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL ?? "");
const trackOrigin =
	originOf(process.env.NEXT_PUBLIC_TRACK_URL ?? "") ??
	(process.env.NODE_ENV === "production" ? "https://track.rastrewin.com" : null);

/*
 * CSP do site. O t.js (track) carrega o Pixel da Meta e o GA4 no navegador, depois do aceite do banner, e
 * conversa com o track: por isso esses hosts estão na lista. 'unsafe-inline' em script-src é o que o Next e o
 * gtag exigem sem nonce; o ganho está no resto: nada de outros hosts, sem iframe, sem <base> nem formulário
 * para fora, e a página não pode ser embutida em outro site (clickjacking no /admin).
 * O gtag manda as coletas do GA4 para analytics.google.com (o domínio raiz, que *.analytics.google.com não
 * cobre) e www.google.com: sem os dois, nenhum evento do GA4 sai da landing.
 */
const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://connect.facebook.net https://www.googletagmanager.com${trackOrigin ? ` ${trackOrigin}` : ""}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' data:",
	`connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${trackOrigin ? ` ${trackOrigin}` : ""} https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net`,
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: contentSecurityPolicy },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

export default {
	async headers() {
		return [{ headers: securityHeaders, source: "/:path*" }];
	},
	output: "standalone",
	// Raiz do monorepo: o standalone passa a gerar frontend/server.js.
	outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
	poweredByHeader: false,
	async rewrites() {
		return apiOrigin ? [] : [{ destination: `${API_TARGET}/:path*`, source: "/api/:path*" }];
	},
};
