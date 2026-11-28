import "server-only";
import { sql } from "drizzle-orm";
import { summarizeOrigins } from "@/lib/tracking/referrer";
import {
	ACTIVE_SALE,
	affiliateFilter,
	type AffiliateOption,
	affiliateOptions,
	affiliateParam,
	notTest,
	num,
	ownHosts,
	rows,
	type SearchParams,
	type TestExcluded,
	testExcluded,
	withDashboard,
} from "./context";
import { daysOf, type Period } from "./period";

export interface DailyPoint {
	day: string;
	value: number;
}

export interface Overview {
	affiliates: AffiliateOption[];
	/** Filtro de afiliado ativo (código ou `~sem`); null = todos. O gasto da Meta nunca é filtrado. */
	affiliateFilter: string | null;
	period: Period;
	timeZone: string;
	currency: string;
	hasAnyData: boolean;
	/** Visitantes de teste do período, fora de todos os números (nota no rodapé). */
	testExcluded: TestExcluded;
	kpis: {
		users: number;
		usersPrev: number;
		events: number;
		eventsPrev: number;
		/** Vendas NOVAS (renovações não contam: compras/conversão medem aquisição). */
		purchases: number;
		purchasesPrev: number;
		/** Receita de TODAS as vendas (é dinheiro que entrou), renovações incluídas. */
		revenue: number;
		revenuePrev: number;
		/** Parte da receita que veio de renovações. */
		renewalRevenue: number;
		/** Receita só das vendas novas (base do ROAS). */
		revenueNew: number;
		revenueNewPrev: number;
	};
	/** Pessoas: Visitou ⊇ Checkout ⊇ Comprou. outsideFunnel = COMPRAS sem ligação ou sem checkout registrado. */
	funnel: { visited: number; checkout: number; purchased: number; outsideFunnel: number };
	eventsByType: { label: string; value: number }[];
	/** Pessoas únicas do período por origem: UTM (fonte) quando houver; senão, o site de onde vieram. */
	origins: { label: string; value: number }[];
	usersByDay: DailyPoint[];
	revenueByDay: DailyPoint[];
}

export function fillDays(period: Period, data: { day: string; value: unknown }[]): DailyPoint[] {
	const map = new Map(data.map(d => [d.day, num(d.value)]));
	return daysOf(period).map(day => ({ day, value: map.get(day) ?? 0 }));
}

export function getOverview(sp: SearchParams): Promise<Overview> {
	return withDashboard(sp, async ({ tx, tz, period, currency }) => {
		// Período anterior = [ps, pe). Nos filtros de mês ele não encosta no atual (01–08/10 × 01–08/11).
		const { start: s, end: e, prevStart: ps, prevEnd: pe } = period;
		// Filtro de afiliado: eventos pelo afiliado do visitante no evento; vendas pelo afiliado da venda.
		const evAff = affiliateFilter(sp, "affiliate_code");
		const evAffL = affiliateFilter(sp, "l.affiliate_code");
		const puAff = affiliateFilter(sp, "affiliate_code");
		const puAffP = affiliateFilter(sp, "p.affiliate_code");
		// Modo teste: visitantes de teste ficam fora de todos os números (nota no rodapé).
		const nt = notTest("events_log.trck_user_id");
		const ntPu = notTest("purchases.trck_user_id");
		const ntL = notTest("l.trck_user_id");
		const ntP = notTest("p.trck_user_id");

		const [ev] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select
        count(distinct trck_user_id) filter (where created_at >= ${s} and created_at < ${e}) as users,
        count(distinct trck_user_id) filter (where created_at < ${pe}) as users_prev,
        count(*) filter (where created_at >= ${s} and created_at < ${e}) as events,
        count(*) filter (where created_at < ${pe}) as events_prev
      from events_log where created_at >= ${ps} and created_at < ${e} and ${evAff} and ${nt}`,
		);

		const [pu] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with p as (
        select coalesce(occurred_at, created_at) as d, value, is_renewal as ren
        from purchases where status in ${ACTIVE_SALE} and ${puAff} and ${ntPu}
      )
      select
        count(*) filter (where d >= ${s} and not ren) as purchases,
        coalesce(sum(value) filter (where d >= ${s}), 0) as revenue,
        coalesce(sum(value) filter (where d >= ${s} and ren), 0) as renewal_revenue,
        coalesce(sum(value) filter (where d >= ${s} and not ren), 0) as revenue_new,
        count(*) filter (where d < ${pe} and not ren) as purchases_prev,
        coalesce(sum(value) filter (where d < ${pe}), 0) as revenue_prev,
        coalesce(sum(value) filter (where d < ${pe} and not ren), 0) as revenue_new_prev
      from p where d >= ${ps} and d < ${e}`,
		);

		// Funil por PESSOAS: Visitou ⊇ Checkout ⊇ Comprou (nunca passa de 100%).
		const [fu] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with visited as (
        select distinct trck_user_id from events_log
        where event_name = 'PageView' and created_at >= ${s} and created_at < ${e} and ${evAff} and ${nt}
      ), checkout as (
        select distinct l.trck_user_id from events_log l join visited v using (trck_user_id)
        where l.event_name = 'InitiateCheckout' and l.created_at >= ${s} and l.created_at < ${e} and ${evAffL} and ${ntL}
      ), buyers as (
        select distinct trck_user_id from purchases
        where status in ${ACTIVE_SALE} and not is_renewal and trck_user_id is not null and ${puAff} and ${ntPu}
          and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
      )
      select
        (select count(*) from visited) as visited,
        (select count(*) from checkout) as checkout,
        (select count(*) from checkout c join buyers b using (trck_user_id)) as purchased,
        (select count(*) from purchases p
          where p.status in ${ACTIVE_SALE} and not p.is_renewal and ${puAffP} and ${ntP}
            and coalesce(p.occurred_at, p.created_at) >= ${s} and coalesce(p.occurred_at, p.created_at) < ${e}
            and (p.trck_user_id is null or p.trck_user_id not in (select trck_user_id from checkout))) as outside`,
		);

		const byType = await rows<{ label: string; value: unknown }>(
			tx,
			sql`
      select event_name as label, count(*) as value from events_log
      where created_at >= ${s} and created_at < ${e} and ${evAff} and ${nt}
      group by event_name order by count(*) desc`,
		);

		const usersByDay = await rows<{ day: string; value: unknown }>(
			tx,
			sql`
      select ((created_at at time zone ${tz})::date)::text as day, count(distinct trck_user_id) as value
      from events_log where created_at >= ${s} and created_at < ${e} and ${evAff} and ${nt} group by 1`,
		);

		const revenueByDay = await rows<{ day: string; value: unknown }>(
			tx,
			sql`
      select ((coalesce(occurred_at, created_at) at time zone ${tz})::date)::text as day, sum(value) as value
      from purchases where status in ${ACTIVE_SALE} and ${puAff} and ${ntPu}
        and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
      group by 1`,
		);

		const [any] = await rows<{ any: boolean }>(
			tx,
			sql`select exists (select 1 from events_log) or exists (select 1 from purchases) as any`,
		);

		const purchases = num(pu.purchases);
		const purchased = num(fu.purchased);
		// Origens: por visitante do período, a utm_source mais recente dos eventos do período; sem UTM,
		// o domínio do referrer guardado (1ª origem externa). Total = usuários únicos do período.
		const originRows = await rows<{
			aff: string | null;
			utm: string | null;
			host: string | null;
			visitors: unknown;
		}>(
			tx,
			sql`
      with p as (
        select trck_user_id,
               (array_agg(utm_source order by created_at desc) filter (where utm_source is not null))[1] as utm,
               (array_agg(affiliate_code order by created_at desc) filter (where affiliate_code is not null))[1] as aff
        from events_log where created_at >= ${s} and created_at < ${e} and ${evAff} and ${nt}
        group by trck_user_id
      )
      select p.aff, p.utm, lower(substring(v.referrer from '^[a-zA-Z]+://([^/:?#]+)')) as host, count(*) as visitors
      from p left join visitors v on v.trck_user_id = p.trck_user_id
      group by 1, 2, 3`,
		);
		const origins = summarizeOrigins(
			originRows.map(r => ({
				affiliate: r.aff,
				referrer: r.host,
				utmSource: r.utm,
				visitors: num(r.visitors),
			})),
			await ownHosts(tx),
		);

		const eventsByType = byType.map(r => ({ label: r.label, value: num(r.value) }));
		if (purchases) eventsByType.push({ label: "Purchase", value: purchases });
		eventsByType.sort((a, b) => b.value - a.value);

		return {
			affiliateFilter: affiliateParam(sp),
			affiliates: await affiliateOptions(tx, sp),
			currency,
			eventsByType,
			funnel: {
				checkout: num(fu.checkout),
				outsideFunnel: num(fu.outside),
				purchased,
				visited: num(fu.visited),
			},
			hasAnyData: Boolean(any?.any),
			kpis: {
				events: num(ev.events),
				eventsPrev: num(ev.events_prev),
				purchases,
				purchasesPrev: num(pu.purchases_prev),
				renewalRevenue: num(pu.renewal_revenue),
				revenue: num(pu.revenue),
				revenueNew: num(pu.revenue_new),
				revenueNewPrev: num(pu.revenue_new_prev),
				revenuePrev: num(pu.revenue_prev),
				users: num(ev.users),
				usersPrev: num(ev.users_prev),
			},
			origins,
			period,
			revenueByDay: fillDays(period, revenueByDay),
			testExcluded: await testExcluded(tx, period),
			timeZone: tz,
			usersByDay: fillDays(period, usersByDay),
		};
	});
}
