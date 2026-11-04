// Em dev, o front chama /api/* e o Next repassa para a API local (rewrite resolvido em
// build time). Em produção o front chama NEXT_PUBLIC_API_URL direto (ver lib/api.ts),
// já que o rewrite não pode variar por ambiente num build standalone.
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_TARGET = process.env.API_INTERNAL_URL ?? "http://localhost:3011";

export default {
	// Raiz do monorepo: o standalone passa a gerar frontend/server.js. No Next 14 a opção
	// ainda fica em experimental (no topo ela é ignorada e o server.js sai na raiz).
	experimental: {
		outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
	},
	output: "standalone",
	async rewrites() {
		return [{ destination: `${API_TARGET}/:path*`, source: "/api/:path*" }];
	},
};
