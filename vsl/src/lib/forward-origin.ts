/*
 * Origem do anúncio no link do botão (VSL → rastrewin.com).
 * A VSL não grava nada: só repassa, na URL do botão, as UTMs e o fbclid com que a pessoa chegou.
 * O t.js da landing lê a URL só DEPOIS do aceite no banner (antes, não grava nem envia nada),
 * então quem não respondeu o banner na VSL e aceita na landing não perde a origem.
 * LGPD: quem recusou o banner (cookie necessário _trck_consent com m: false) não leva a origem adiante.
 */

/** UTMs e o clique da Meta. Nenhum outro parâmetro da URL é repassado. */
export const ORIGIN_KEYS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"fbclid",
] as const;

/** Mesmo limite que o t.js aplica às UTMs guardadas. */
const MAX_VALUE = 300;

/** Parâmetros de origem presentes na query da VSL (só os de ORIGIN_KEYS, não vazios, até 300 caracteres). */
export function originParams(search: string): [string, string][] {
	const query = new URLSearchParams(search);
	const out: [string, string][] = [];
	for (const key of ORIGIN_KEYS) {
		const value = query.get(key)?.trim();
		if (value) out.push([key, value.slice(0, MAX_VALUE)]);
	}
	return out;
}

/**
 * A pessoa recusou o banner? Lê o cookie necessário _trck_consent ({ id, v, m }) que o t.js grava em
 * .rastrewin.com. Recusa em qualquer versão do texto conta (regra conservadora). Sem cookie ou cookie
 * inválido = não respondeu.
 */
export function refusedConsent(cookieString: string): boolean {
	const match = cookieString.match(/(?:^|;\s*)_trck_consent=([^;]*)/);
	if (!match) return false;
	try {
		const consent = JSON.parse(decodeURIComponent(match[1] ?? "")) as { m?: unknown } | null;
		return consent?.m === false;
	} catch {
		return false;
	}
}

/** Link do botão: o destino com a origem do anúncio, sem sobrescrever o que ele já tiver. Recusa = destino puro. */
export function ctaHref(destination: string, search: string, cookieString: string): string {
	if (refusedConsent(cookieString)) return destination;
	const params = originParams(search);
	if (!params.length) return destination;
	try {
		const url = new URL(destination);
		for (const [key, value] of params) if (!url.searchParams.has(key)) url.searchParams.set(key, value);
		return url.toString();
	} catch {
		return destination;
	}
}
