import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, rows, type SearchParams, withDashboard } from "./context";
import { daysOf, type Period } from "./period";

export interface DailyPoint {
	day: string;
	value: number;
}

export interface Overview {
	period: Period;
	timeZone: string;
	currency: string;
	hasAnyData: boolean;
	kpis: {
		users: number;
		usersPrev: number;
		events: number;
		eventsPrev: number;
		purchases: number;
		purchasesPrev: number;
		revenue: number;
		revenuePrev: number;
	};
	/** Pessoas: Visitou ⊇ Checkout ⊇ Comprou. outsideFunnel = COMPRAS sem ligação ou sem checkout registrado. */
	funnel: { visited: number; checkout: number; purchased: number; outsideFunnel: number };
	eventsByType: { label: string; value: number }[];
	usersByDay: DailyPoint[];
	revenueByDay: DailyPoint[];
}

export function fillDays(period: Period, data: { day: string; value: unknown }[]): DailyPoint[] {
	const map = new Map(data.map(d => [d.day, num(d.value)]));
	return daysOf(period).map(day => ({ day, value: map.get(day) ?? 0 }));
}

export function getOverview(sp: SearchParams): Promise<Overview> {
	return withDashboard(sp, async ({ tx, tz, period, currency }) => {
		const { start: s, end: e, prevStart: ps } = period;

		const [ev] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select
        count(distinct trck_user_id) filter (where created_at >= ${s} and created_at < ${e}) as users,
        count(distinct trck_user_id) filter (where created_at < ${s}) as users_prev,
        count(*) filter (where created_at >= ${s} and created_at < ${e}) as events,
        count(*) filter (where created_at < ${s}) as events_prev
      from events_log where created_at >= ${ps} and created_at < ${e}`,
		);

		const [pu] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with p as (
        select coalesce(occurred_at, created_at) as d, value from purchases where status in ${ACTIVE_SALE}
      )
      select
        count(*) filter (where d >= ${s}) as purchases,
        coalesce(sum(value) filter (where d >= ${s}), 0) as revenue,
        count(*) filter (where d < ${s}) as purchases_prev,
        coalesce(sum(value) filter (where d < ${s}), 0) as revenue_prev
      from p where d >= ${ps} and d < ${e}`,
		);

		// Funil por PESSOAS: Visitou ⊇ Checkout ⊇ Comprou (nunca passa de 100%).
		const [fu] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with visited as (
        select distinct trck_user_id from events_log
        where event_name = 'PageView' and created_at >= ${s} and created_at < ${e}
      ), checkout as (
        select distinct l.trck_user_id from events_log l join visited v using (trck_user_id)
        where l.event_name = 'InitiateCheckout' and l.created_at >= ${s} and l.created_at < ${e}
      ), buyers as (
        select distinct trck_user_id from purchases
        where status in ${ACTIVE_SALE} and trck_user_id is not null
          and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
      )
      select
        (select count(*) from visited) as visited,
        (select count(*) from checkout) as checkout,
        (select count(*) from checkout c join buyers b using (trck_user_id)) as purchased,
        (select count(*) from purchases p
          where p.status in ${ACTIVE_SALE}
            and coalesce(p.occurred_at, p.created_at) >= ${s} and coalesce(p.occurred_at, p.created_at) < ${e}
            and (p.trck_user_id is null or p.trck_user_id not in (select trck_user_id from checkout))) as outside`,
		);

		const byType = await rows<{ label: string; value: unknown }>(
			tx,
			sql`
      select event_name as label, count(*) as value from events_log
      where created_at >= ${s} and created_at < ${e}
      group by event_name order by count(*) desc`,
		);

		const usersByDay = await rows<{ day: string; value: unknown }>(
			tx,
			sql`
      select ((created_at at time zone ${tz})::date)::text as day, count(distinct trck_user_id) as value
      from events_log where created_at >= ${s} and created_at < ${e} group by 1`,
		);

		const revenueByDay = await rows<{ day: string; value: unknown }>(
			tx,
			sql`
      select ((coalesce(occurred_at, created_at) at time zone ${tz})::date)::text as day, sum(value) as value
      from purchases where status in ${ACTIVE_SALE}
        and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
      group by 1`,
		);

		const [any] = await rows<{ any: boolean }>(
			tx,
			sql`select exists (select 1 from events_log) or exists (select 1 from purchases) as any`,
		);

		const purchases = num(pu.purchases);
		const purchased = num(fu.purchased);
		const eventsByType = byType.map(r => ({ label: r.label, value: num(r.value) }));
		if (purchases) eventsByType.push({ label: "Purchase", value: purchases });
		eventsByType.sort((a, b) => b.value - a.value);

		return {
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
				revenue: num(pu.revenue),
				revenuePrev: num(pu.revenue_prev),
				users: num(ev.users),
				usersPrev: num(ev.users_prev),
			},
			period,
			revenueByDay: fillDays(period, revenueByDay),
			timeZone: tz,
			usersByDay: fillDays(period, usersByDay),
		};
	});
}
