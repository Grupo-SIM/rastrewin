import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, rows, withDashboard, type SearchParams } from "./context";
import { countryName } from "./format";
import type { Period } from "./period";

export type UfStat = { uf: string; visitors: number; purchases: number; revenue: number };
export type Geo = {
  period: Period;
  currency: string;
  byUf: UfStat[];
  countries: { label: string; value: number }[];
  cities: { city: string; region: string | null; country: string | null; visitors: number }[];
  totals: { visitors: number; withGeo: number };
};

export function getGeo(sp: SearchParams): Promise<Geo> {
  return withDashboard(sp, async ({ tx, period, currency }) => {
    const { start: s, end: e } = period;
    const visitors = await rows<{ uf: string; v: unknown }>(tx, sql`
      select geo_region as uf, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} and geo_country = 'BR' and geo_region ~ '^[A-Z]{2}$'
      group by 1`);
    const sales = await rows<{ uf: string; c: unknown; r: unknown }>(tx, sql`
      select geo_region as uf, count(*) as c, sum(value) as r from purchases
      where status in ${ACTIVE_SALE} and coalesce(occurred_at, created_at) >= ${s} and coalesce(occurred_at, created_at) < ${e}
        and geo_country = 'BR' and geo_region ~ '^[A-Z]{2}$'
      group by 1`);
    const countries = await rows<{ c: string | null; v: unknown }>(tx, sql`
      select geo_country as c, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} group by 1 order by 2 desc`);
    const cities = await rows<{ city: string; region: string | null; country: string | null; v: unknown }>(tx, sql`
      select geo_city as city, geo_region as region, geo_country as country, count(distinct trck_user_id) as v from events_log
      where created_at >= ${s} and created_at < ${e} and geo_city is not null
      group by 1, 2, 3 order by 4 desc limit 20`);
    const [t] = await rows<{ total: unknown; geo: unknown }>(tx, sql`
      select count(distinct trck_user_id) as total, count(distinct trck_user_id) filter (where geo_country is not null) as geo
      from events_log where created_at >= ${s} and created_at < ${e}`);

    const ufs = new Map<string, UfStat>();
    const get = (uf: string) => ufs.get(uf) ?? ufs.set(uf, { uf, visitors: 0, purchases: 0, revenue: 0 }).get(uf)!;
    for (const v of visitors) get(v.uf).visitors = num(v.v);
    for (const p of sales) Object.assign(get(p.uf), { purchases: num(p.c), revenue: num(p.r) });

    // Top 10 países + "Outros" (barras ordenadas; nunca mais cores)
    const known = countries.filter((c) => c.c);
    const top = known.slice(0, 10).map((c) => ({ label: countryName(c.c), value: num(c.v) }));
    const rest = known.slice(10).reduce((sum, c) => sum + num(c.v), 0) + countries.filter((c) => !c.c).reduce((sum, c) => sum + num(c.v), 0);
    if (rest) top.push({ label: "Outros / desconhecido", value: rest });

    return {
      period,
      currency,
      byUf: [...ufs.values()],
      countries: top,
      cities: cities.map((c) => ({ city: c.city, region: c.region, country: c.country, visitors: num(c.v) })),
      totals: { visitors: num(t?.total), withGeo: num(t?.geo) },
    };
  });
}
