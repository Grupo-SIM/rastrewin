import "server-only";
import { eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { purchases, visitors } from "@/db/schema";
import { buildMpBody, type MpItem, sendMp } from "@/lib/ga4/mp";
import {
	buildEvent,
	type CapiCustomData,
	type CapiPerson,
	fbcFromFbclid,
	sendToPixels,
} from "@/lib/meta/capi";
import { capiFailureReason } from "@/lib/meta/capi-errors";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { isAttemptDue, MAX_ATTEMPTS, RETRY_OFFSETS_SECONDS } from "./retry-schedule";
import { isRefunded, isSaleActive, META_MAX_AGE_MS, type PurchaseItem } from "./simintpay";

/*
 * Envio da compra (Purchase) para TODOS os pixels (CAPI) e TODAS as propriedades GA4 (MP),
 * e do reembolso (refund) ao GA4. Idempotente: usa meta_sent_at / ga4_sent_at / refund_sent_at.
 * Chamado pelo webhook (em after()), pelo reenvio automático e pelo botão "Reenviar agora".
 */

/** A Meta pede country sempre; o SimIntPay só vende no Brasil, então é o padrão sem geo do visitante. */
const DEFAULT_COUNTRY = "br";
export { MAX_ATTEMPTS };

/**
 * Quem pede o envio:
 *   - webhook: venda nova ou mudança de status; tenta na hora enquanto houver tentativas;
 *   - retry: reenvio automático; só o destino cuja próxima tentativa já chegou (retry-schedule.ts);
 *   - manual: "Reenviar agora" do Administrador; ignora o calendário e o limite de tentativas
 *     e não conta como tentativa (o prazo de 7 dias da Meta continua valendo).
 */
export type DeliveryMode = "webhook" | "retry" | "manual";

interface DeliveryReport {
	meta?: string;
	ga4?: string;
	refund?: string;
}

type PurchaseRow = typeof purchases.$inferSelect;
type VisitorRow = typeof visitors.$inferSelect;

export function itemsOf(p: PurchaseRow): PurchaseItem[] {
	const items = (p.items as PurchaseItem[] | null) ?? [];
	if (items.length) return items;
	return [
		{
			id: p.product ?? p.transactionId,
			name: p.product ?? "Produto",
			price: Number(p.value),
			type: null,
		},
	];
}

/**
 * Respostas anteriores por destino (pixel ou propriedade GA4). O reenvio vai só a quem ainda não
 * confirmou: com vários destinos, repetir para quem já recebeu duplicaria a compra.
 */
function previousOk(previous: unknown): Record<string, { ok: boolean }> {
	return previous && typeof previous === "object" && !Array.isArray(previous)
		? (previous as Record<string, { ok: boolean }>)
		: {};
}

/** custom_data da venda para a Meta (Purchase e AddPaymentInfo usam a mesma base). */
export function saleCustomData(p: PurchaseRow, items: PurchaseItem[]): CapiCustomData {
	return {
		content_ids: items.map(i => i.id),
		content_name: p.product ?? items[0]?.name,
		content_type: "product",
		contents: items.map(i => ({ id: i.id, item_price: i.price, quantity: 1 })),
		currency: p.currency,
		order_id: p.transactionId,
		value: Number(p.value),
	};
}

/** Quem comprou, para a CAPI: o que o webhook não trouxer (ex.: telefone) vem do visitante ligado à venda. */
export function salePerson(p: PurchaseRow, visitor: VisitorRow | undefined, eventTime: Date): CapiPerson {
	return {
		city: p.geoCity,
		country: p.geoCountry ?? DEFAULT_COUNTRY,
		emHash: p.emHash ?? visitor?.emHash ?? null,
		externalId: p.trckUserId,
		fbc: p.fbc ?? fbcFromFbclid(p.fbclid, eventTime),
		fbp: p.fbp,
		fnHash: p.fnHash ?? visitor?.fnHash ?? null,
		ip: visitor?.ip ?? null,
		lnHash: p.lnHash ?? visitor?.lnHash ?? null,
		phHash: p.phHash ?? visitor?.phHash ?? null,
		region: p.geoRegion,
		userAgent: visitor?.userAgent ?? null,
	};
}

/** Página do evento da venda: a de entrada do visitante, senão a raiz do 1º site autorizado. */
export function saleSourceUrl(visitor: VisitorRow | undefined, allowedOrigins: string[]): string | null {
	return visitor?.landingUrl ?? (allowedOrigins[0] ? `${allowedOrigins[0]}/` : null);
}

// Trava por compra: o webhook (after) e o reenvio automático rodam no mesmo processo
// e não podem enviar a mesma compra ao mesmo tempo (o GA4 não deduplica como a Meta).
const g = globalThis as unknown as { __purchaseInFlight?: Set<number> };
const inFlight = (g.__purchaseInFlight ??= new Set<number>());

export async function deliverPurchase(
	purchaseId: number,
	mode: DeliveryMode = "webhook",
): Promise<DeliveryReport> {
	if (inFlight.has(purchaseId)) return {};
	inFlight.add(purchaseId);
	try {
		return await deliverPurchaseUnlocked(purchaseId, mode);
	} finally {
		inFlight.delete(purchaseId);
	}
}

async function deliverPurchaseUnlocked(purchaseId: number, mode: DeliveryMode): Promise<DeliveryReport> {
	const db = serviceDb();
	const [p] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
	if (!p) return {};
	// Renovação/recompra: o anúncio gerou a 1ª compra; esta fica só no Faturamento.
	if (p.isRenewal) return {};
	// LGPD: sem aceite de marketing do visitante ligado à venda, a compra não vai à Meta nem ao GA4.
	// (O refund só sai para compra já enviada ao GA4, então segue a mesma regra.)
	const consented = p.marketingConsent === true;
	const config = await getRuntimeConfig();
	const [visitor] = p.trckUserId
		? await db.select().from(visitors).where(eq(visitors.trckUserId, p.trckUserId)).limit(1)
		: [];
	// Modo teste (decisão A do plano 0008): a compra fica no Faturamento, sem Purchase à Meta nem ao GA4.
	// O refund continua: só sai para compra já enviada (visitante marcado depois), e desfaz o envio.
	const sendable = consented && visitor?.isTest !== true;
	const report: DeliveryReport = {};
	if (consented && !sendable) report.meta = report.ga4 = "teste";
	const value = Number(p.value);
	const items = itemsOf(p);
	const occurredAt = p.occurredAt ?? p.createdAt;
	const now = new Date();
	const mayTry = (attempts: number) =>
		mode === "manual" ||
		(mode === "retry" ? isAttemptDue(occurredAt, attempts, now) : attempts < MAX_ATTEMPTS);
	// O clique manual não gasta tentativa: senão, cliques repetidos numa pane adiantariam o calendário
	// e o reenvio automático desistiria antes dos 7 dias.
	const countsAsAttempt = mode === "manual" ? 0 : 1;
	const visit = {
		city: p.geoCity,
		country: p.geoCountry,
		ip: visitor?.ip ?? null,
		region: p.geoRegion,
		userAgent: visitor?.userAgent ?? null,
	};

	// ------------------------------------------------------------ Purchase → Meta (CAPI)
	if (
		sendable &&
		isSaleActive(p.status) &&
		!p.metaSentAt &&
		config.pixels.length &&
		mayTry(p.metaAttempts)
	) {
		if (Date.now() - occurredAt.getTime() > META_MAX_AGE_MS) {
			await db
				.update(purchases)
				.set({ lastDeliveryError: "Meta: venda com mais de 7 dias (fora do prazo da CAPI)" })
				.where(eq(purchases.id, p.id));
			report.meta = "fora do prazo";
		} else {
			const userAgent = visitor?.userAgent ?? null;
			const event = buildEvent({
				// "website" exige user agent; venda sem visitante vai como "system_generated".
				actionSource: userAgent ? "website" : "system_generated",
				customData: saleCustomData(p, items),
				eventId: p.metaEventId ?? `purchase_${p.transactionId}`,
				eventName: "Purchase",
				eventSourceUrl: saleSourceUrl(visitor, config.allowedOrigins),
				eventTime: occurredAt,
				person: salePerson(p, visitor, occurredAt),
			});
			const before = previousOk(p.responseMeta);
			const pending = config.pixels.filter(px => !before[px.pixelId]?.ok);
			const sent = await sendToPixels(pending, event, config.testEventCode);
			const payload = sent.payload;
			const responses = { ...before, ...sent.responses };
			const allOk = config.pixels.every(px => responses[px.pixelId]?.ok);
			const errors = Object.entries(sent.responses)
				.filter(([, r]) => !r.ok)
				.map(([id, r]) => `pixel ${id}: ${capiFailureReason(r)}`);
			await db
				.update(purchases)
				.set({
					lastDeliveryError: allOk ? null : `Meta: ${errors.join("; ")}`,
					metaAttempts: sql`${purchases.metaAttempts} + ${countsAsAttempt}`,
					metaSentAt: allOk ? new Date() : null,
					payloadMeta: payload,
					responseMeta: responses,
				})
				.where(eq(purchases.id, p.id));
			report.meta = allOk ? "enviado" : "falhou";
		}
	}

	// ------------------------------------------------------------ purchase → GA4 (MP)
	const mpItems: MpItem[] = items.map(i => ({
		item_id: i.id,
		item_name: i.name,
		price: i.price,
		quantity: 1,
		...(i.type ? { item_category: i.type } : {}),
	}));
	if (sendable && isSaleActive(p.status) && !p.ga4SentAt && config.ga4.length && mayTry(p.ga4Attempts)) {
		const body = buildMpBody({
			clientId: p.gaClientId,
			currency: p.currency,
			debug: config.ga4Debug,
			items: mpItems,
			name: "purchase",
			occurredAt,
			sessionId: p.gaSessionId,
			transactionId: p.transactionId,
			value,
			visit,
		});
		const before = previousOk(p.responseGa4);
		const pending = config.ga4.filter(a => !before[a.measurementId]?.ok);
		const responses = { ...before, ...(await sendMp(pending, body, config.ga4Debug)) };
		const allOk = config.ga4.every(a => responses[a.measurementId]?.ok);
		await db
			.update(purchases)
			.set({
				ga4Attempts: sql`${purchases.ga4Attempts} + ${countsAsAttempt}`,
				ga4SentAt: allOk ? new Date() : null,
				payloadGa4: body,
				responseGa4: responses,
				...(allOk ? {} : { lastDeliveryError: "GA4: falha no Measurement Protocol" }),
			})
			.where(eq(purchases.id, p.id));
		report.ga4 = allOk ? "enviado" : "falhou";
	}

	// ------------------------------------------------------------ refund → GA4 (só se a compra foi enviada)
	if (isRefunded(p.status) && p.ga4SentAt && !p.refundSentAt && config.ga4.length) {
		const body = buildMpBody({
			clientId: p.gaClientId,
			currency: p.currency,
			debug: config.ga4Debug,
			// Itens no refund: o GA4 recomenda para as métricas de reembolso por item.
			items: mpItems,
			name: "refund",
			occurredAt: p.refundedAt,
			sessionId: p.gaSessionId,
			transactionId: p.transactionId,
			value,
			visit,
		});
		const before = previousOk((p.refundResponseGa4 as { responses?: unknown } | null)?.responses);
		const pending = config.ga4.filter(a => !before[a.measurementId]?.ok);
		const responses = { ...before, ...(await sendMp(pending, body, config.ga4Debug)) };
		const allOk = config.ga4.every(a => responses[a.measurementId]?.ok);
		await db
			.update(purchases)
			.set({ refundResponseGa4: { payload: body, responses }, refundSentAt: allOk ? new Date() : null })
			.where(eq(purchases.id, p.id));
		report.refund = allOk ? "enviado" : "falhou";
	}

	return report;
}

/** Hora da tentativa seguinte de um destino, pelo calendário (null depois da última). Constantes: SQL fixo. */
const OFFSETS = sql.raw(`array[${RETRY_OFFSETS_SECONDS.join(",")}]::int[]`);
const dueAt = (attempts: "meta_attempts" | "ga4_attempts") =>
	sql`coalesce(occurred_at, created_at) + (${OFFSETS})[${sql.raw(attempts)} + 1] * interval '1 second'`;

/** Compras com envio pendente cuja próxima tentativa já chegou (para o reenvio automático). */
export async function pendingPurchaseIds(limit = 50): Promise<number[]> {
	const rows = await serviceDb().execute<{ id: number }>(sql`
    select id from purchases
    where not is_renewal and (
      marketing_consent is true and status in ('approved', 'refund_requested')
      and not exists (select 1 from visitors v where v.trck_user_id = purchases.trck_user_id and v.is_test)
      and (meta_sent_at is null and ${dueAt("meta_attempts")} <= now()
        or ga4_sent_at is null and ${dueAt("ga4_attempts")} <= now())
      and coalesce(occurred_at, created_at) > now() - interval '7 days'
    ) or (
      status in ('refunded', 'chargeback') and ga4_sent_at is not null and refund_sent_at is null
      and updated_at > now() - interval '7 days'
    )
    order by id
    limit ${limit}`);
	return rows.rows.map(r => Number(r.id));
}
