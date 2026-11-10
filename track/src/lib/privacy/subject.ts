import "server-only";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { hashed, normEmail, normPhone } from "@/lib/tracking/normalize";

/*
 * Direitos do titular (LGPD art. 18): ACESSO (export) e EXCLUSÃO (erase) dos dados de uma pessoa no track.
 * Chamado só pelo backend do rastrewin, depois que a pessoa confirmou o email (rotas /api/privacy/*,
 * assinadas). A pessoa é achada pelo HASH do email e/ou do telefone (o mesmo da Meta), e daí pelos
 * ids de visitante (trck_user_id) ligados a ela.
 */

export interface Subject {
	email?: string | null;
	phone?: string | null;
}

export function subjectHashes(s: Subject) {
	return { emHash: hashed(normEmail(s.email)), phHash: hashed(normPhone(s.phone)) };
}

/**
 * Array do JS como literal de array do Postgres, num parâmetro só (o sql do Drizzle expandiria um
 * array em vários parâmetros, o que quebra `= any(...)` e o array vazio).
 */
export function pgTextArray(values: string[]): string {
	return `{${values.map(v => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

type Tx = Parameters<Parameters<ReturnType<typeof serviceDb>["transaction"]>[0]>[0];

/** Ids de visitante da pessoa: visitantes com o mesmo email/telefone e visitantes ligados às compras dela. */
async function visitorIdsOf(tx: Tx, emHash: string | null, phHash: string | null): Promise<string[]> {
	const rows = await tx.execute<{ id: string }>(sql`
    select trck_user_id as id from visitors
     where (${emHash}::text is not null and em_hash = ${emHash}) or (${phHash}::text is not null and ph_hash = ${phHash})
    union
    select trck_user_id from purchases
     where trck_user_id is not null
       and ((${emHash}::text is not null and em_hash = ${emHash}) or (${phHash}::text is not null and ph_hash = ${phHash}))`);
	return rows.rows.map(r => r.id);
}

/** Compras da pessoa: pelo email/telefone ou pelos visitantes dela. */
function purchaseFilter(emHash: string | null, phHash: string | null, ids: string[]) {
	return sql`((${emHash}::text is not null and em_hash = ${emHash})
      or (${phHash}::text is not null and ph_hash = ${phHash})
      or trck_user_id = any(${pgTextArray(ids)}::text[]))`;
}

/** ACESSO: tudo o que o track guarda sobre a pessoa, em linguagem de dados (sem campos internos). */
export async function exportSubject(subject: Subject) {
	const { emHash, phHash } = subjectHashes(subject);
	if (!emHash && !phHash) return null;
	return serviceDb().transaction(async tx => {
		const ids = await visitorIdsOf(tx, emHash, phHash);
		const visitors = await tx.execute(sql`
      select trck_user_id as visitor_id, email, created_at as first_seen_at, updated_at as last_seen_at,
             landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             fbp as meta_browser_id, fbc as meta_click_id, ga_client_id as google_client_id,
             ip, user_agent, geo_city as city, geo_region as region, geo_country as country,
             consent_marketing, consent_at,
             (em_hash is not null) as email_hash_kept, (ph_hash is not null) as phone_hash_kept,
             (fn_hash is not null or ln_hash is not null) as name_hash_kept
        from visitors where trck_user_id = any(${pgTextArray(ids)}::text[]) order by created_at`);
		const events = await tx.execute(sql`
      select event_name as event, created_at as at, event_source_url as page, value, currency,
             utm_source, utm_campaign, geo_city as city, geo_region as region
        from events_log where trck_user_id = any(${pgTextArray(ids)}::text[]) order by created_at limit 5000`);
		const videos = await tx.execute(sql`
      select video_title as video, started_at as at, max_position_s as reached_second, watched_s as watched_seconds
        from video_views where trck_user_id = any(${pgTextArray(ids)}::text[]) order by started_at limit 2000`);
		const purchases = await tx.execute(sql`
      select transaction_id as order_id, coalesce(occurred_at, created_at) as at, status, value, currency, product,
             payment_method, utm_source, utm_campaign,
             (meta_sent_at is not null) as sent_to_meta, (ga4_sent_at is not null) as sent_to_google
        from purchases where ${purchaseFilter(emHash, phHash, ids)} order by created_at`);
		const consents = await tx.execute(sql`
      select created_at as at, action, marketing, version, origin, page_path
        from consent_records where trck_user_id = any(${pgTextArray(ids)}::text[]) order by created_at`);
		return {
			consents: consents.rows,
			events: events.rows,
			purchases: purchases.rows,
			videos: videos.rows,
			visitors: visitors.rows,
		};
	});
}

export interface EraseResult {
	visitors: number;
	events: number;
	videos: number;
	purchases: number;
	webhookEvents: number;
	consents: number;
	gaClientIds: number;
}

/**
 * EXCLUSÃO: apaga visitante, eventos e plays; anonimiza as compras (ficam valor, data, status, produto
 * e UTMs, para o faturamento e a obrigação fiscal) e o payload bruto do webhook; desliga o
 * visitante dos registros de consentimento (a prova continua, anônima). Tudo numa transação.
 * Registra em privacy_erasures os hashes (para anonimizar vendas futuras da mesma pessoa) e os
 * client_ids do GA4 que precisam ser apagados à mão.
 */
export async function eraseSubject(subject: Subject): Promise<EraseResult | null> {
	const { emHash, phHash } = subjectHashes(subject);
	if (!emHash && !phHash) return null;
	return serviceDb().transaction(async tx => {
		const ids = await visitorIdsOf(tx, emHash, phHash);
		const ga = await tx.execute<{ id: string }>(sql`
      select distinct ga_client_id as id from (
        select ga_client_id from visitors where trck_user_id = any(${pgTextArray(ids)}::text[])
        union all
        select ga_client_id from purchases where ${purchaseFilter(emHash, phHash, ids)}
      ) x where ga_client_id is not null`);
		const gaClientIds = ga.rows.map(r => r.id);

		const orders = await tx.execute<{ transaction_id: string }>(sql`
      select transaction_id from purchases where ${purchaseFilter(emHash, phHash, ids)}`);
		const orderIds = orders.rows.map(r => r.transaction_id);

		const purchases = await tx.execute(sql`
      update purchases set
        email = null, em_hash = null, ph_hash = null, fn_hash = null, ln_hash = null,
        fbc = null, fbp = null, fbclid = null, src = null, trck_user_id = null,
        ga_client_id = null, ga_session_id = null, geo_city = null,
        webhook_raw = null, payload_meta = null, response_meta = null, payload_ga4 = null, response_ga4 = null,
        refund_response_ga4 = null, match = null, last_delivery_error = null, updated_at = now()
      where transaction_id = any(${pgTextArray(orderIds)}::text[])`);
		const webhookEvents = await tx.execute(sql`
      update webhook_events set payload = '{"redacted": true}'::jsonb, error = null
       where order_id = any(${pgTextArray(orderIds)}::text[]) and payload <> '{"redacted": true}'::jsonb`);
		const events = await tx.execute(
			sql`delete from events_log where trck_user_id = any(${pgTextArray(ids)}::text[])`,
		);
		const videos = await tx.execute(
			sql`delete from video_views where trck_user_id = any(${pgTextArray(ids)}::text[])`,
		);
		const consents = await tx.execute(sql`
      update consent_records set trck_user_id = null where trck_user_id = any(${pgTextArray(ids)}::text[])`);
		const visitors = await tx.execute(
			sql`delete from visitors where trck_user_id = any(${pgTextArray(ids)}::text[])`,
		);

		const result: EraseResult = {
			consents: consents.rowCount ?? 0,
			events: events.rowCount ?? 0,
			gaClientIds: gaClientIds.length,
			purchases: purchases.rowCount ?? 0,
			videos: videos.rowCount ?? 0,
			visitors: visitors.rowCount ?? 0,
			webhookEvents: webhookEvents.rowCount ?? 0,
		};
		await tx.execute(sql`
      insert into privacy_erasures (em_hash, ph_hash, counts, ga_client_ids)
      values (${emHash}, ${phHash}, ${JSON.stringify(result)}::jsonb, ${pgTextArray(gaClientIds)}::text[])`);
		return result;
	});
}

/**
 * A pessoa pediu exclusão nos últimos 30 dias? Então um evento de venda dela que ainda estava a caminho
 * (o relay do backend tenta por até ~3 dias) chega anonimizado. Depois disso não vale mais: quem se
 * cadastrar de novo é tratado como pessoa nova (e passa pelo banner de novo).
 */
export async function isErased(emHash: string | null, phHash: string | null): Promise<boolean> {
	if (!emHash && !phHash) return false;
	const rows = await serviceDb().execute<{ found: boolean }>(sql`
    select exists (
      select 1 from privacy_erasures
       where created_at > now() - interval '30 days'
         and ((${emHash}::text is not null and em_hash = ${emHash}) or (${phHash}::text is not null and ph_hash = ${phHash}))
    ) as found`);
	return rows.rows[0]?.found === true;
}
