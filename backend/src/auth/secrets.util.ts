import { createHmac } from "node:crypto";

/**
 * Segredo de cada uso. Cada um pode ter o seu (RESET_CODE_SECRET, PRIVACY_TOKEN_SECRET); sem ele, cai no
 * JWT_SECRET. Mesmo no fallback, o texto assinado leva um prefixo por uso (`purpose`), então um hash feito
 * para um fim nunca vale para outro. Sem nenhum segredo, falha: a chave não pode virar vazia em silêncio.
 */
export function hmacFor(purpose: "reset" | "privacy", envName: string, message: string) {
	const secret = process.env[envName]?.trim() || process.env.JWT_SECRET?.trim();
	if (!secret) throw new Error(`${envName} ou JWT_SECRET não configurado`);
	return createHmac("sha256", secret).update(`${purpose}:${message}`).digest("hex");
}
