/*
 * Rastreamento do visitante (track.rastrewin.com): guardado no cadastro e repassado com a venda.
 * Mesmas chaves e limite da allowlist do SimIntPay (payment-tracking.ts): só strings de até 500 caracteres.
 * src = trck_user_id do visitante (cookie _trck do t.js), usado pelo track para ligar a venda à visita.
 * consent = escolha do banner no cadastro (ver CONSENT_VALUES).
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

/**
 * Escolha do banner de cookies na visita do cadastro (LGPD), enviada pelo site: "granted" (aceitou
 * marketing) ou "rejected" (recusou). Com "rejected", o rastreamento vira SÓ a recusa: ela substitui
 * o que um cadastro anterior tinha gravado, e o track não liga a venda a nenhum visitante nem a envia
 * à Meta/GA4, mesmo que encontre um aceite antigo pelo e-mail ou telefone.
 */
const CONSENT_VALUES = ["granted", "rejected"] as const;

/** Filtra para as chaves conhecidas, com valor string não vazio. Sem nada útil, devolve null. */
export function sanitizeTracking(input: unknown): Record<string, string> | null {
	if (!input || typeof input !== "object" || Array.isArray(input)) return null;
	const source = input as Record<string, unknown>;
	if (source.consent === "rejected") return { consent: "rejected" };
	const out: Record<string, string> = {};
	if ((CONSENT_VALUES as readonly unknown[]).includes(source.consent))
		out.consent = source.consent as string;
	for (const key of TRACKING_KEYS) {
		const value = source[key];
		if (typeof value !== "string") continue;
		const trimmed = value.trim();
		if (trimmed && trimmed.length <= MAX) out[key] = trimmed;
	}
	return Object.keys(out).length ? out : null;
}
