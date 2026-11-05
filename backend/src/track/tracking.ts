/*
 * Rastreamento do visitante (track.rastrewin.com): guardado no cadastro e repassado com a venda.
 * Mesmas chaves e limite da allowlist do SimIntPay (payment-tracking.ts): só strings de até 500 caracteres.
 * src = trck_user_id do visitante (cookie _trck do t.js), usado pelo track para ligar a venda à visita.
 */

export const TRACKING_KEYS = [
	"src",
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"fbclid",
	"fbc",
	"fbp",
] as const;

const MAX = 500;

/** Filtra para as chaves conhecidas, com valor string não vazio. Sem nada útil, devolve null. */
export function sanitizeTracking(input: unknown): Record<string, string> | null {
	if (!input || typeof input !== "object" || Array.isArray(input)) return null;
	const source = input as Record<string, unknown>;
	const out: Record<string, string> = {};
	for (const key of TRACKING_KEYS) {
		const value = source[key];
		if (typeof value !== "string") continue;
		const trimmed = value.trim();
		if (trimmed && trimmed.length <= MAX) out[key] = trimmed;
	}
	return Object.keys(out).length ? out : null;
}
