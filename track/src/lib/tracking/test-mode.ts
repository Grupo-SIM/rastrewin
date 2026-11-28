import { type SQL, sql } from "drizzle-orm";

/*
 * Modo teste (visitante da equipe: `?rw_teste=1` no site ou marcado na jornada do painel).
 * Nada dele vai à Meta nem ao GA4, e os relatórios ignoram seus eventos, plays e compras.
 */

/** Resposta gravada no lugar da da Meta/GA4 quando o envio foi pulado por ser teste. */
export const TEST_RESPONSE = { test: true } as const;

/**
 * ÚNICO ponto da regra do modo teste nos relatórios (plano 0008): tira as linhas de visitante de teste.
 * `column` é a coluna trck_user_id QUALIFICADA da tabela consultada ("events_log.trck_user_id",
 * "l.trck_user_id"), sempre um literal do código. Sem a tabela, dentro da subconsulta o nome cairia
 * na coluna de `visitors` e a condição tiraria TUDO: por isso só aceita "tabela.coluna".
 * Linha sem visitante (venda sem ligação) fica. Usa o índice parcial `visitors_test_idx`.
 * A aba Eventos e a jornada mostram tudo (com o selo); os demais relatórios usam isto em toda consulta.
 */
export function notTest(column: string): SQL {
	if (!/^[a-z_]+\.trck_user_id$/.test(column))
		throw new Error(`notTest: coluna não qualificada (${column})`);
	return sql`not exists (select 1 from visitors tv where tv.is_test and tv.trck_user_id = ${sql.raw(column)})`;
}
