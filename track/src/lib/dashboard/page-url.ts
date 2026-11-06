import { type SQL, sql } from "drizzle-orm";

/*
 * Chave de uma página no painel: domínio + caminho, em minúsculas, sem protocolo, sem "www.",
 * sem ?query (utm_*, fbclid…), sem #hash e sem a barra final.
 *   https://VSL.rastrewin.com/?utm_source=fb#x  →  vsl.rastrewin.com
 *   https://www.rastrewin.com/privacidade/      →  rastrewin.com/privacidade
 * pageKey() (JS) e pageKeySql() (Postgres) fazem EXATAMENTE a mesma coisa; os testes cobrem os dois lados.
 */

export function pageKey(url: string): string {
	const noHash = url.split("#")[0] ?? "";
	const noQuery = noHash.split("?")[0] ?? "";
	return noQuery
		.toLowerCase()
		.replace(/^https?:\/\/(www\.)?/, "")
		.replace(/\/+$/, "");
}

/** Mesma regra de pageKey(), para usar no SQL sobre uma coluna de URL. */
export function pageKeySql(column: SQL): SQL {
	return sql`rtrim(regexp_replace(lower(split_part(split_part(${column}, '#', 1), '?', 1)), '^https?://(www\\.)?', ''), '/')`;
}

/** Link para abrir a página a partir da chave. */
export function pageHref(key: string): string {
	return `https://${key}`;
}
