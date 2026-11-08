import "server-only";
import { sql } from "drizzle-orm";
import { num, param, rows, type SearchParams, withDashboard } from "./context";
import type { Period } from "./period";

export const DELIVERY_FILTERS = [
	{ key: "todos", label: "Todos os envios" },
	{ key: "ok", label: "Meta: ok" },
	{ key: "erro", label: "Meta: com erro" },
	{ key: "pendente", label: "Meta: sem envio" },
	{ key: "expirado", label: "Payload expirado" },
] as const;

/** Status do envio à Meta de cada evento (derivado do log). */
export const META_STATUS = sql`
  case
    when l.payload_meta is null and l.response_meta is null and l.created_at < now() - interval '14 days' then 'expirado'
    when l.response_meta is null then 'pendente'
    when l.response_meta ? 'skipped' then 'pendente'
    when l.response_meta ? 'error' then 'erro'
    when exists (select 1 from jsonb_each(l.response_meta) r where coalesce((r.value->>'ok')::boolean, false) = false) then 'erro'
    else 'ok'
  end`;

export interface EventRow {
	id: number;
	createdAt: string;
	eventName: string;
	eventId: string;
	trckUserId: string;
	value: number | null;
	currency: string | null;
	utmSource: string | null;
	utmCampaign: string | null;
	place: string | null;
	metaStatus: "ok" | "erro" | "pendente" | "expirado";
}

export interface EventsPage {
	period: Period;
	timeZone: string;
	rows: EventRow[];
	total: number;
	page: number;
	pageSize: number;
	eventNames: string[];
	filters: { tipo: string; envio: string; q: string };
}

const PAGE_SIZE = 50;

export function getEvents(sp: SearchParams): Promise<EventsPage> {
	return withDashboard(sp, async ({ tx, tz, period }) => {
		const { start: s, end: e } = period;
		const tipo = (param(sp, "tipo") ?? "").slice(0, 40);
		const envio = DELIVERY_FILTERS.some(f => f.key === param(sp, "envio"))
			? param(sp, "envio")!
			: "todos";
		const q = (param(sp, "q") ?? "").trim().slice(0, 100);
		const page = Math.max(1, Math.min(10_000, Number(param(sp, "page")) || 1));

		const where = sql.join(
			[
				sql`l.created_at >= ${s} and l.created_at < ${e}`,
				...(tipo ? [sql`l.event_name = ${tipo}`] : []),
				...(q
					? [
							sql`(l.trck_user_id = ${q} or l.event_id = ${q} or l.utm_campaign ilike ${`%${q}%`} or l.utm_source ilike ${`%${q}%`})`,
						]
					: []),
			],
			sql` and `,
		);
		const statusFilter = envio === "todos" ? sql`true` : sql`meta_status = ${envio}`;

		const [{ total }] = await rows<{ total: unknown }>(
			tx,
			sql`
      select count(*) as total from (select ${META_STATUS} as meta_status from events_log l where ${where}) x where ${statusFilter}`,
		);
		const list = await rows<Record<string, unknown>>(
			tx,
			sql`
      select * from (
        select l.id, l.created_at, l.event_name, l.event_id, l.trck_user_id, l.value, l.currency, l.utm_source, l.utm_campaign,
               nullif(concat_ws(', ', l.geo_city, l.geo_region, l.geo_country), '') as place,
               ${META_STATUS} as meta_status
        from events_log l where ${where}
      ) x where ${statusFilter}
      order by created_at desc, id desc
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
		);
		const names = await rows<{ event_name: string }>(
			tx,
			sql`
      select distinct event_name from events_log where created_at >= ${s} and created_at < ${e} order by 1`,
		);

		return {
			eventNames: names.map(n => n.event_name),
			filters: { envio, q, tipo },
			page,
			pageSize: PAGE_SIZE,
			period,
			rows: list.map(x => ({
				createdAt: new Date(x.created_at as string).toISOString(),
				currency: (x.currency as string) ?? null,
				eventId: String(x.event_id),
				eventName: String(x.event_name),
				id: num(x.id),
				metaStatus: x.meta_status as EventRow["metaStatus"],
				place: (x.place as string) ?? null,
				trckUserId: String(x.trck_user_id),
				utmCampaign: (x.utm_campaign as string) ?? null,
				utmSource: (x.utm_source as string) ?? null,
				value: x.value === null ? null : num(x.value),
			})),
			timeZone: tz,
			total: num(total),
		};
	});
}
