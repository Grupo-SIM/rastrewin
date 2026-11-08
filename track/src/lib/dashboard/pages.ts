import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, param, rows, type SearchParams, withDashboard } from "./context";
import { pageKeySql } from "./page-url";
import type { Period } from "./period";

/*
 * Conversão por página. Uma pessoa conta em TODA página que viu no período (decisão do usuário):
 * quem viu a VSL e o cadastro e comprou aparece nas duas. Por isso as linhas não somam o total.
 *   - Visualizações: PageViews da página.
 *   - Usuários: trck_user_id distintos que viram a página.
 *   - Checkout: desses usuários, quantos tiveram InitiateCheckout no período (em qualquer página).
 *   - Compradores/compras/receita: desses usuários, compras aprovadas (ou em mediação) no período,
 *     sem renovação, ligadas pelo trck_user_id — as mesmas regras do Faturamento.
 */

/** Linhas por página da tabela (a lista inteira é navegável com Anterior/Próxima). */
const PAGE_SIZE = 100;

export interface PageStat {
	page: string;
	views: number;
	users: number;
	checkout: number;
	buyers: number;
	purchases: number;
	revenue: number;
}
export interface PagesView {
	period: Period;
	currency: string;
	q: string | null;
	rows: PageStat[];
	page: number;
	pageSize: number;
	totals: { pages: number; views: number; users: number; checkout: number; buyers: number };
}

export function getPages(sp: SearchParams): Promise<PagesView> {
	return withDashboard(sp, async ({ tx, period, currency }) => {
		const { start: s, end: e } = period;
		const q = param(sp, "q")?.trim().toLowerCase().slice(0, 200) || null;
		const pageNum = Math.max(1, Math.min(10_000, Number(param(sp, "page")) || 1));
		const page = pageKeySql(sql`event_source_url`);
		const search = q ? sql`and strpos(page, ${q}) > 0` : sql``;

		const base = sql`
      pv as (
        select ${page} as page, trck_user_id from events_log
        where event_name = 'PageView' and created_at >= ${s} and created_at < ${e}
      ),
      ic as (
        select distinct trck_user_id from events_log
        where event_name = 'InitiateCheckout' and created_at >= ${s} and created_at < ${e}
      ),
      buyers as (
        select trck_user_id, count(*) as c, sum(value) as r from purchases
        where status in ${ACTIVE_SALE} and not is_renewal and trck_user_id is not null
          and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
        group by 1
      )`;

		const list = await rows<Record<string, unknown>>(
			tx,
			sql`
      with ${base},
      per_page as (
        select page, count(*) as views, count(distinct trck_user_id) as users from pv
        where page <> '' ${search} group by page
      ),
      viewers as (select distinct page, trck_user_id from pv where page <> '' ${search})
      select p.page, p.views, p.users,
             count(ic.trck_user_id) as checkout,
             count(b.trck_user_id) as buyers,
             coalesce(sum(b.c), 0) as purchases,
             coalesce(sum(b.r), 0) as revenue
      from per_page p
      join viewers v on v.page = p.page
      left join ic on ic.trck_user_id = v.trck_user_id
      left join buyers b on b.trck_user_id = v.trck_user_id
      group by p.page, p.views, p.users
      order by p.users desc, p.views desc, p.page
      limit ${PAGE_SIZE} offset ${(pageNum - 1) * PAGE_SIZE}`,
		);

		// Totais do período: pessoas DISTINTAS (não a soma das linhas, que repete quem viu várias páginas).
		const [t] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with ${base},
      viewers as (select distinct trck_user_id from pv where page <> '' ${search})
      select (select count(distinct page) from pv where page <> '' ${search}) as pages,
             (select count(*) from pv where page <> '' ${search}) as views,
             count(*) as users,
             count(ic.trck_user_id) as checkout,
             count(b.trck_user_id) as buyers
      from viewers v
      left join ic on ic.trck_user_id = v.trck_user_id
      left join buyers b on b.trck_user_id = v.trck_user_id`,
		);

		return {
			currency,
			page: pageNum,
			pageSize: PAGE_SIZE,
			period,
			q,
			rows: list.map(r => ({
				buyers: num(r.buyers),
				checkout: num(r.checkout),
				page: String(r.page),
				purchases: num(r.purchases),
				revenue: num(r.revenue),
				users: num(r.users),
				views: num(r.views),
			})),
			totals: {
				buyers: num(t?.buyers),
				checkout: num(t?.checkout),
				pages: num(t?.pages),
				users: num(t?.users),
				views: num(t?.views),
			},
		};
	});
}
