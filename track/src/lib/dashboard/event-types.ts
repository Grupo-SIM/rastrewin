/*
 * Filtro "Tipo de evento" com várias opções. Na URL vai como lista separada por vírgula
 * (?tipo=PageView,InitiateCheckout); um link antigo com um tipo só continua valendo.
 */

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_TYPES = 30;

/** Lê `?tipo=` em uma lista limpa: só nomes válidos de evento, sem repetição, na ordem dada. */
export function parseEventTypes(raw: string | null | undefined): string[] {
	if (!raw) return [];
	const out: string[] = [];
	for (const part of raw.split(",")) {
		const name = part.trim();
		if (NAME.test(name) && !out.includes(name)) out.push(name);
		if (out.length >= MAX_TYPES) break;
	}
	return out;
}

/** Monta o valor de `?tipo=` (null = todos os tipos). */
export function serializeEventTypes(types: readonly string[]): string | null {
	const clean = parseEventTypes(types.join(","));
	return clean.length ? clean.join(",") : null;
}
