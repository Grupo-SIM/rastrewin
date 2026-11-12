import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, rows, type SearchParams, withDashboard } from "./context";
import { countryName } from "./format";
import type { Period } from "./period";

/** Teto de cidades enviadas à tela (que mostra de 20 em 20). O total real vem em `citiesTotal`. */
export const CITIES_MAX = 500;

export interface UfStat {
	uf: string;
	visitors: number;
	purchases: number;
	revenue: number;
}
export interface Geo {
	period: Period;
	currency: string;
	byUf: UfStat[];
	/** Gráfico: 10 maiores + "Outros / desconhecido". */
	countries: { label: string; value: number }[];
	/** Tabela: todos os países, sem agrupar. */
	allCountries: { label: string; value: number }[];
	cities: { city: string; region: string | null; country: string | null; visitors: number }[];
	citiesTotal: number;
	totals: { visitors: number; withGeo: number };
}

export function getGeo(sp: SearchParams): Promise<Geo> {
	return withDashboard(sp, async ({ tx, period, currency }) => {
		const { start: s, end: e } = period;
		const visitors = await rows<{ uf: string; v: unknown }>(
			tx,
			sql`
      select geo_region as uf, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} and geo_country = 'BR' and geo_region ~ '^[A-Z]{2}$'
      group by 1`,
		);
		const sales = await rows<{ uf: string; c: unknown; r: unknown }>(
			tx,
			sql`
      select geo_region as uf, count(*) as c, sum(value) as r from purchases
      where status in ${ACTIVE_SALE} and not is_renewal and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
        and geo_country = 'BR' and geo_region ~ '^[A-Z]{2}$'
      group by 1`,
		);
		const countries = await rows<{ c: string | null; v: unknown }>(
			tx,
			sql`
      select geo_country as c, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} group by 1 order by 2 desc, 1`,
		);
		const cities = await rows<{
			city: string;
			region: string | null;
			country: string | null;
			v: unknown;
		}>(
			tx,
			sql`
      select geo_city as city, geo_region as region, geo_country as country, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} and geo_city is not null
      group by 1, 2, 3 order by 4 desc, 1, 2, 3 limit ${CITIES_MAX}`,
		);
		const [ct] = await rows<{ n: unknown }>(
			tx,
			sql`
      select count(*) as n from (
        select 1 from events_log
        where created_at >= ${s} and created_at < ${e} and geo_city is not null
        group by geo_city, geo_region, geo_country
      ) x`,
		);
		const [t] = await rows<{ total: unknown; geo: unknown }>(
			tx,
			sql`
      select count(distinct trck_user_id) as total, count(distinct trck_user_id) filter (where geo_country is not null) as geo
      from events_log where created_at >= ${s} and created_at < ${e}`,
		);

		const ufs = new Map<string, UfStat>();
		const get = (uf: string) =>
			ufs.get(uf) ?? ufs.set(uf, { purchases: 0, revenue: 0, uf, visitors: 0 }).get(uf)!;
		for (const v of visitors) get(v.uf).visitors = num(v.v);
		for (const p of sales) Object.assign(get(p.uf), { purchases: num(p.c), revenue: num(p.r) });

		// Top 10 países + "Outros" (barras ordenadas; nunca mais cores)
		const known = countries.filter(c => c.c);
		const top = known.slice(0, 10).map(c => ({ label: countryName(c.c), value: num(c.v) }));
		const rest =
			known.slice(10).reduce((sum, c) => sum + num(c.v), 0) +
			countries.filter(c => !c.c).reduce((sum, c) => sum + num(c.v), 0);
		if (rest) top.push({ label: "Outros / desconhecido", value: rest });

		const allCountries = countries.map(c => ({
			label: c.c ? countryName(c.c) : "Desconhecido",
			value: num(c.v),
		}));

		return {
			allCountries,
			byUf: [...ufs.values()],
			cities: cities.map(c => ({
				city: c.city,
				country: c.country,
				region: c.region,
				visitors: num(c.v),
			})),
			citiesTotal: num(ct?.n),
			countries: top,
			currency,
			period,
			totals: { visitors: num(t?.total), withGeo: num(t?.geo) },
		};
	});
}
