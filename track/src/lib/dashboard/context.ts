import "server-only";
import { eq, type SQL, sql } from "drizzle-orm";
import type { ReaderTx } from "@/db";
import { settings } from "@/db/schema";
import { readAsUser } from "@/lib/dal";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { ownHostsOf } from "@/lib/tracking/referrer";
import { AFFILIATE_PARAM, NO_AFFILIATE } from "./affiliate";
import { type Period, resolvePeriod } from "./period";

export type SearchParams = Record<string, string | string[] | undefined>;
export interface DashboardCtx {
	tx: ReaderTx;
	tz: string;
	period: Period;
	currency: string;
}

export function param(sp: SearchParams, key: string): string | null {
	const v = sp[key];
	return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * Abre UMA transação de leitura (app_reader + RLS, sessão validada) para a página,
 * lê o fuso/moeda do painel e resolve o período a partir da URL.
 */
export function withDashboard<T>(sp: SearchParams, fn: (ctx: DashboardCtx) => Promise<T>): Promise<T> {
	return readAsUser(async tx => {
		const [row] = await tx
			.select({ currency: settings.currency, timezone: settings.timezone })
			.from(settings)
			.where(eq(settings.id, 1));
		const tz = row?.timezone ?? DEFAULT_TIMEZONE;
		const periodo = param(sp, "periodo");
		const period = resolvePeriod(
			{ ate: param(sp, "ate"), de: param(sp, "de"), periodo },
			tz,
			undefined,
			periodo === "max" ? await firstDataDay(tx, tz) : null,
		);
		return fn({ currency: row?.currency ?? "BRL", period, tx, tz });
	});
}

/** Data local (no fuso) do registro mais antigo do track: visita, evento ou venda. null sem dados. */
export async function firstDataDay(tx: ReaderTx, tz: string): Promise<string | null> {
	const [r] = await rows<{ day: string | null }>(
		tx,
		sql`select ((least(
          (select min(created_at) from visitors),
          (select min(created_at) from events_log),
          (select min(coalesce(occurred_at, created_at)) from purchases)
        ) at time zone ${tz})::date)::text as day`,
	);
	return r?.day ?? null;
}

/** Sites próprios (origens autorizadas + domínios do checkout): referrer deles não é origem. */
export async function ownHosts(tx: ReaderTx): Promise<string[]> {
	const [row] = await tx
		.select({ allowed: settings.allowedOrigins, checkout: settings.checkoutDomains })
		.from(settings)
		.where(eq(settings.id, 1));
	return ownHostsOf(row?.allowed, row?.checkout);
}

/** Executa SQL e devolve as linhas tipadas. */
export async function rows<T>(tx: ReaderTx, query: SQL): Promise<T[]> {
	const result = await tx.execute(query);
	return result.rows as T[];
}

export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

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

/** Visitantes de teste com atividade no período (evento ou venda): a nota "ficaram fora destes números". */
export interface TestExcluded {
	visitors: number;
	events: number;
}

export async function testExcluded(tx: ReaderTx, period: Period): Promise<TestExcluded> {
	const { start: s, end: e } = period;
	const [r] = await rows<{ visitors: unknown; events: unknown }>(
		tx,
		sql`
      with t as (select trck_user_id from visitors where is_test),
      ev as (
        select l.trck_user_id from events_log l join t using (trck_user_id)
        where l.created_at >= ${s} and l.created_at < ${e}
      ),
      pu as (
        select p.trck_user_id from purchases p join t using (trck_user_id)
        where coalesce(p.occurred_at, p.created_at) >= ${s} and coalesce(p.occurred_at, p.created_at) < ${e}
      )
      select (select count(*) from (select trck_user_id from ev union select trck_user_id from pu) x) as visitors,
             (select count(*) from ev) as events`,
	);
	return { events: num(r?.events), visitors: num(r?.visitors) };
}

/** Statuses que contam como venda (aprovada ou em mediação). */
export const ACTIVE_SALE = sql`('approved', 'refund_requested')`;
export const REFUNDED = sql`('refunded', 'chargeback')`;

/** Filtro de afiliado da URL: um código, `NO_AFFILIATE` ou null (todos). Valor inválido = sem filtro. */
export function affiliateParam(sp: SearchParams): string | null {
	const v = param(sp, "afiliado");
	return v === NO_AFFILIATE || (v !== null && AFFILIATE_PARAM.test(v)) ? v : null;
}

/**
 * ÚNICO ponto da regra do filtro "Afiliado" (`?afiliado=CODE`). Devolve a condição SQL para a coluna
 * `affiliate_code` da tabela consultada (`column`, ex.: "p.affiliate_code"); sem filtro devolve `true`.
 * Use em toda consulta que o filtro afeta (events_log, video_views e purchases têm a coluna).
 * `column` é sempre um literal do código, nunca entrada do usuário.
 */
export function affiliateFilter(sp: SearchParams, column = "affiliate_code"): SQL {
	const selected = affiliateParam(sp);
	const col = sql.raw(column);
	if (selected === null) return sql`true`;
	if (selected === NO_AFFILIATE) return sql`${col} is null`;
	return sql`${col} = ${selected}`;
}

export interface AffiliateOption {
	code: string;
	/** Nome informado pela SimIntPay (da venda mais recente), se houver. */
	name: string | null;
}

/** Códigos conhecidos (vendas e visitantes) com o nome, para o filtro. O selecionado sempre aparece. */
export async function affiliateOptions(tx: ReaderTx, sp: SearchParams): Promise<AffiliateOption[]> {
	const list = await rows<{ code: string; name: string | null }>(
		tx,
		sql`
      with codes as (
        select affiliate_code as code from purchases where affiliate_code is not null
        union
        select affiliate_code from visitors where affiliate_code is not null
      )
      select c.code,
             (select p.affiliate_name from purchases p
               where p.affiliate_code = c.code and p.affiliate_name is not null
               order by p.updated_at desc limit 1) as name
      from codes c order by lower(c.code) limit 300`,
	);
	const selected = affiliateParam(sp);
	if (selected && selected !== NO_AFFILIATE && !list.some(o => o.code === selected))
		list.push({ code: selected, name: null });
	return list;
}
