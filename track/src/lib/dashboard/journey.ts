import "server-only";
import { sql } from "drizzle-orm";
import { TRCK_ID } from "@/lib/tracking/schemas";
import { num, rows, withDashboard } from "./context";
import { META_STATUS } from "./events";
import { latestChronological, type Utm } from "./journey-format";

/*
 * Jornada do visitante: tudo o que existe sobre um trck_user_id, SEM filtro de período.
 * Fontes: visitors (dados e origem), events_log (eventos), video_views (plays), purchases +
 * webhook_events (cada mudança de status das compras). Leitura com app_reader + RLS.
 */

/** Itens por "página" da linha do tempo; "Carregar anteriores" soma mais um bloco. */
export const JOURNEY_STEP = 200;
const MAX_ITEMS = 5000;

const utmOf = (r: Record<string, unknown>): Utm => ({
	campaign: (r.utm_campaign as string) ?? null,
	content: (r.utm_content as string) ?? null,
	medium: (r.utm_medium as string) ?? null,
	source: (r.utm_source as string) ?? null,
	term: (r.utm_term as string) ?? null,
});
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const iso = (v: unknown) => (v ? new Date(v as string | Date).toISOString() : null);
const place = (r: Record<string, unknown>) =>
	[r.geo_city, r.geo_region, r.geo_country].filter(Boolean).join(", ") || null;

export type JourneyItem =
	| {
			kind: "event";
			at: string;
			key: string;
			eventId: string;
			name: string;
			url: string | null;
			value: number | null;
			currency: string | null;
			utm: Utm;
			ip: string | null;
			userAgent: string | null;
			place: string | null;
			metaStatus: string;
	  }
	| {
			kind: "video";
			at: string;
			key: string;
			lastAt: string;
			videoId: string;
			title: string | null;
			pageUrl: string | null;
			durationS: number;
			maxPositionS: number;
			watchedS: number;
			completed: boolean;
			ctaS: number | null;
			utm: Utm;
			place: string | null;
	  }
	| {
			kind: "sale";
			at: string;
			key: string;
			transactionId: string;
			eventType: string;
			amount: number | null;
			product: string | null;
			isRenewal: boolean;
	  };

export interface JourneyPurchase {
	transactionId: string;
	status: string;
	value: number;
	currency: string | null;
	product: string | null;
	paymentMethod: string | null;
	isRenewal: boolean;
	occurredAt: string | null;
	matchBy: string | null;
	matchReason: string | null;
	utm: Utm;
	fbclid: string | null;
}

export interface Journey {
	id: string;
	timeZone: string;
	currency: string;
	visitor: {
		email: string | null;
		name: string | null;
		phone: string | null;
		fbc: string | null;
		fbp: string | null;
		gaClientId: string | null;
		gaSessionId: string | null;
		ip: string | null;
		userAgent: string | null;
		place: string | null;
		landingUrl: string | null;
		referrer: string | null;
		utm: Utm;
		createdAt: string | null;
		updatedAt: string | null;
	} | null;
	firstSeen: string | null;
	lastSeen: string | null;
	/** Primeiro registro com UTM (evento, play ou compra): a origem do primeiro toque. */
	firstTouch: { at: string; utm: Utm; url: string | null } | null;
	purchases: JourneyPurchase[];
	related: { id: string; createdAt: string; updatedAt: string; by: "email" | "telefone" }[];
	counts: { events: number; videos: number; sales: number; total: number };
	items: JourneyItem[];
	shown: number;
	hasMore: boolean;
}

/** Quantos itens mostrar, a partir do ?ver= da URL (blocos de JOURNEY_STEP). */
export function journeyLimit(ver: string | null): number {
	const n = Number(ver);
	if (!Number.isFinite(n) || n < JOURNEY_STEP) return JOURNEY_STEP;
	return Math.min(MAX_ITEMS, Math.ceil(n / JOURNEY_STEP) * JOURNEY_STEP);
}

/** null = ID inválido (formato) — a tela mostra a mensagem certa sem consultar o banco. */
export function getJourney(id: string, ver: string | null): Promise<Journey | null> {
	if (!TRCK_ID.test(id)) return Promise.resolve(null);
	const limit = journeyLimit(ver);

	return withDashboard({}, async ({ tx, tz, currency }) => {
		const [v] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select email, em_hash, ph_hash, fbc, fbp, ga_client_id, ga_session_id, host(ip) as ip, user_agent,
             geo_city, geo_region, geo_country, landing_url, referrer,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at, updated_at
      from visitors where trck_user_id = ${id}`,
		);

		const [c] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select
        (select count(*) from events_log where trck_user_id = ${id}) as events,
        (select count(*) from video_views where trck_user_id = ${id}) as videos,
        (select count(*) from webhook_events w join purchases p on p.transaction_id = w.order_id
          where p.trck_user_id = ${id}) as sales,
        (select min(created_at) from events_log where trck_user_id = ${id}) as first_event,
        (select max(created_at) from events_log where trck_user_id = ${id}) as last_event`,
		);

		const events = await rows<Record<string, unknown>>(
			tx,
			sql`
      select l.id, l.created_at, l.event_id, l.event_name, l.event_source_url, l.value, l.currency,
             l.utm_source, l.utm_medium, l.utm_campaign, l.utm_term, l.utm_content,
             host(l.ip) as ip, l.user_agent, l.geo_city, l.geo_region, l.geo_country,
             ${META_STATUS} as meta_status
      from events_log l where l.trck_user_id = ${id}
      order by l.created_at desc, l.id desc limit ${limit}`,
		);

		const videos = await rows<Record<string, unknown>>(
			tx,
			sql`
      select id, started_at, updated_at, video_id, video_title, page_url, duration_s, max_position_s,
             watched_s, completed, cta_s, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             geo_city, geo_region, geo_country
      from video_views where trck_user_id = ${id}
      order by started_at desc, id desc limit ${limit}`,
		);

		// Cada evento de venda recebido (PIX gerado, aprovada, reembolso...) vira um item próprio.
		const sales = await rows<Record<string, unknown>>(
			tx,
			sql`
      select w.id, w.event_type, p.transaction_id, p.product, p.is_renewal,
             coalesce((w.payload->>'occurredAt')::timestamptz, w.received_at) as at,
             (w.payload->>'amountCents')::numeric / 100 as amount
      from webhook_events w join purchases p on p.transaction_id = w.order_id
      where p.trck_user_id = ${id}
      order by 6 desc, w.id desc limit ${limit}`,
		);

		const purchaseRows = await rows<Record<string, unknown>>(
			tx,
			sql`
      select transaction_id, status, value, currency, product, payment_method, is_renewal,
             coalesce(occurred_at, created_at) as occurred_at, match->>'by' as match_by,
             match->>'reason' as match_reason, fbclid,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             webhook_raw->>'customerName' as customer_name, webhook_raw->>'phone' as phone
      from purchases where trck_user_id = ${id}
      order by coalesce(occurred_at, created_at) desc limit 100`,
		);

		// Mesma pessoa em outro aparelho: outros visitantes com o mesmo hash de e-mail ou telefone.
		const related = v
			? await rows<Record<string, unknown>>(
					tx,
					sql`
          select trck_user_id, created_at, updated_at,
                 case when em_hash is not null and em_hash = ${v.em_hash ?? null} then 'email' else 'telefone' end as by
          from visitors
          where trck_user_id <> ${id}
            and ((${v.em_hash ?? null}::text is not null and em_hash = ${v.em_hash ?? null})
              or (${v.ph_hash ?? null}::text is not null and ph_hash = ${v.ph_hash ?? null}))
          order by updated_at desc limit 20`,
				)
			: [];

		const items = latestChronological<JourneyItem>(
			[
				events.map(r => ({
					at: iso(r.created_at)!,
					currency: str(r.currency),
					eventId: String(r.event_id),
					ip: str(r.ip),
					key: `e${r.id}`,
					kind: "event" as const,
					metaStatus: String(r.meta_status),
					name: String(r.event_name),
					place: place(r),
					url: str(r.event_source_url),
					userAgent: str(r.user_agent),
					utm: utmOf(r),
					value: r.value === null ? null : num(r.value),
				})),
				videos.map(r => ({
					at: iso(r.started_at)!,
					completed: r.completed === true,
					ctaS: r.cta_s === null ? null : num(r.cta_s),
					durationS: num(r.duration_s),
					key: `v${r.id}`,
					kind: "video" as const,
					lastAt: iso(r.updated_at)!,
					maxPositionS: num(r.max_position_s),
					pageUrl: str(r.page_url),
					place: place(r),
					title: str(r.video_title),
					utm: utmOf(r),
					videoId: String(r.video_id),
					watchedS: num(r.watched_s),
				})),
				sales.map(r => ({
					amount: r.amount === null ? null : num(r.amount),
					at: iso(r.at)!,
					eventType: String(r.event_type),
					isRenewal: r.is_renewal === true,
					key: `s${r.id}`,
					kind: "sale" as const,
					product: str(r.product),
					transactionId: String(r.transaction_id),
				})),
			],
			limit,
		);

		// Primeiro toque: o registro mais antigo que tenha UTM (em qualquer fonte).
		const [ft] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select at, url, utm_source, utm_medium, utm_campaign, utm_term, utm_content from (
        select created_at as at, event_source_url as url, utm_source, utm_medium, utm_campaign, utm_term, utm_content
        from events_log where trck_user_id = ${id} and coalesce(utm_source, utm_medium, utm_campaign, utm_term, utm_content) is not null
        union all
        select started_at, page_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content
        from video_views where trck_user_id = ${id} and coalesce(utm_source, utm_medium, utm_campaign, utm_term, utm_content) is not null
      ) x order by at asc limit 1`,
		);

		const latestBuyer = purchaseRows.find(r => r.customer_name || r.phone);
		const counts = {
			events: num(c?.events),
			sales: num(c?.sales),
			total: num(c?.events) + num(c?.videos) + num(c?.sales),
			videos: num(c?.videos),
		};
		const times = [iso(v?.created_at), iso(c?.first_event), ...items.map(i => i.at)].filter(
			(t): t is string => !!t,
		);
		const lastTimes = [iso(v?.updated_at), iso(c?.last_event), ...items.map(i => i.at)].filter(
			(t): t is string => !!t,
		);

		return {
			counts,
			currency,
			firstSeen: times.sort()[0] ?? null,
			firstTouch: ft ? { at: iso(ft.at)!, url: str(ft.url), utm: utmOf(ft) } : null,
			hasMore: counts.total > items.length,
			id,
			items,
			lastSeen: lastTimes.sort().at(-1) ?? null,
			purchases: purchaseRows.map(r => ({
				currency: str(r.currency),
				fbclid: str(r.fbclid),
				isRenewal: r.is_renewal === true,
				matchBy: str(r.match_by),
				matchReason: str(r.match_reason),
				occurredAt: iso(r.occurred_at),
				paymentMethod: str(r.payment_method),
				product: str(r.product),
				status: String(r.status),
				transactionId: String(r.transaction_id),
				utm: utmOf(r),
				value: num(r.value),
			})),
			related: related.map(r => ({
				by: r.by === "email" ? ("email" as const) : ("telefone" as const),
				createdAt: iso(r.created_at)!,
				id: String(r.trck_user_id),
				updatedAt: iso(r.updated_at)!,
			})),
			shown: items.length,
			timeZone: tz,
			visitor: v
				? {
						createdAt: iso(v.created_at),
						email: str(v.email),
						fbc: str(v.fbc),
						fbp: str(v.fbp),
						gaClientId: str(v.ga_client_id),
						gaSessionId: str(v.ga_session_id),
						ip: str(v.ip),
						landingUrl: str(v.landing_url),
						name: str(latestBuyer?.customer_name),
						phone: str(latestBuyer?.phone),
						place: place(v),
						referrer: str(v.referrer),
						updatedAt: iso(v.updated_at),
						userAgent: str(v.user_agent),
						utm: utmOf(v),
					}
				: null,
		};
	});
}
