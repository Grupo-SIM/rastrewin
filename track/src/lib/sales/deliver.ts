import "server-only";
import { eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { purchases, visitors } from "@/db/schema";
import { buildMpBody, type MpItem, sendMp } from "@/lib/ga4/mp";
import { buildEvent, type CapiCustomData, fbcFromFbclid, sendToPixels } from "@/lib/meta/capi";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { isRefunded, isSaleActive, type PurchaseItem } from "./simintpay";

/*
 * Envio da compra (Purchase) para TODOS os pixels (CAPI) e TODAS as propriedades GA4 (MP),
 * e do reembolso (refund) ao GA4. Idempotente: usa meta_sent_at / ga4_sent_at / refund_sent_at.
 * Chamado pelo webhook (em after()) e pelo reenvio automático.
 */

const META_MAX_AGE_MS = 7 * 24 * 3600 * 1000; // a Meta aceita event_time de até 7 dias
/** A Meta pede country sempre; o SimIntPay só vende no Brasil, então é o padrão sem geo do visitante. */
const DEFAULT_COUNTRY = "br";
export const MAX_ATTEMPTS = 5;

interface DeliveryReport {
	meta?: string;
	ga4?: string;
	refund?: string;
}

function itemsOf(p: typeof purchases.$inferSelect): PurchaseItem[] {
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

// Trava por compra: o webhook (after) e o reenvio automático rodam no mesmo processo
// e não podem enviar a mesma compra ao mesmo tempo (o GA4 não deduplica como a Meta).
const g = globalThis as unknown as { __purchaseInFlight?: Set<number> };
const inFlight = (g.__purchaseInFlight ??= new Set<number>());

export async function deliverPurchase(purchaseId: number): Promise<DeliveryReport> {
	if (inFlight.has(purchaseId)) return {};
	inFlight.add(purchaseId);
	try {
		return await deliverPurchaseUnlocked(purchaseId);
	} finally {
		inFlight.delete(purchaseId);
	}
}

async function deliverPurchaseUnlocked(purchaseId: number): Promise<DeliveryReport> {
	const db = serviceDb();
	const [p] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
	if (!p) return {};
	// Renovação/recompra: o anúncio gerou a 1ª compra; esta fica só no Faturamento.
	if (p.isRenewal) return {};
	const config = await getRuntimeConfig();
	const [visitor] = p.trckUserId
		? await db.select().from(visitors).where(eq(visitors.trckUserId, p.trckUserId)).limit(1)
		: [];
	const report: DeliveryReport = {};
	const value = Number(p.value);
	const items = itemsOf(p);
	const occurredAt = p.occurredAt ?? p.createdAt;

	// ------------------------------------------------------------ Purchase → Meta (CAPI)
	if (isSaleActive(p.status) && !p.metaSentAt && config.pixels.length && p.metaAttempts < MAX_ATTEMPTS) {
		if (Date.now() - occurredAt.getTime() > META_MAX_AGE_MS) {
			await db
				.update(purchases)
				.set({ lastDeliveryError: "Meta: venda com mais de 7 dias (fora do prazo da CAPI)" })
				.where(eq(purchases.id, p.id));
			report.meta = "fora do prazo";
		} else {
			const userAgent = visitor?.userAgent ?? null;
			const customData: CapiCustomData = {
				content_ids: items.map(i => i.id),
				content_name: p.product ?? items[0]?.name,
				content_type: "product",
				contents: items.map(i => ({ id: i.id, item_price: i.price, quantity: 1 })),
				currency: p.currency,
				order_id: p.transactionId,
				value,
			};
			const event = buildEvent({
				// "website" exige user agent; venda sem visitante vai como "system_generated".
				actionSource: userAgent ? "website" : "system_generated",
				customData,
				eventId: p.metaEventId ?? `purchase_${p.transactionId}`,
				eventName: "Purchase",
				eventSourceUrl:
					visitor?.landingUrl ?? (config.allowedOrigins[0] ? `${config.allowedOrigins[0]}/` : null),
				eventTime: occurredAt,
				// O que o webhook não trouxer (ex.: telefone) vem do visitante ligado à venda.
				person: {
					city: p.geoCity,
					country: p.geoCountry ?? DEFAULT_COUNTRY,
					emHash: p.emHash ?? visitor?.emHash ?? null,
					externalId: p.trckUserId,
					fbc: p.fbc ?? fbcFromFbclid(p.fbclid, occurredAt),
					fbp: p.fbp,
					fnHash: p.fnHash ?? visitor?.fnHash ?? null,
					ip: visitor?.ip ?? null,
					lnHash: p.lnHash ?? visitor?.lnHash ?? null,
					phHash: p.phHash ?? visitor?.phHash ?? null,
					region: p.geoRegion,
					userAgent,
				},
			});
			const { payload, responses } = await sendToPixels(config.pixels, event, config.testEventCode);
			const allOk = Object.values(responses).every(r => r.ok);
			const errors = Object.entries(responses)
				.filter(([, r]) => !r.ok)
				.map(([id, r]) => `pixel ${id}: HTTP ${r.status}`);
			await db
				.update(purchases)
				.set({
					lastDeliveryError: allOk ? null : `Meta: ${errors.join("; ")}`,
					metaAttempts: sql`${purchases.metaAttempts} + 1`,
					metaSentAt: allOk ? new Date() : null,
					payloadMeta: payload,
					responseMeta: responses,
				})
				.where(eq(purchases.id, p.id));
			report.meta = allOk ? "enviado" : "falhou";
		}
	}

	// ------------------------------------------------------------ purchase → GA4 (MP)
	if (isSaleActive(p.status) && !p.ga4SentAt && config.ga4.length && p.ga4Attempts < MAX_ATTEMPTS) {
		const mpItems: MpItem[] = items.map(i => ({
			item_id: i.id,
			item_name: i.name,
			price: i.price,
			quantity: 1,
			...(i.type ? { item_category: i.type } : {}),
		}));
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
		});
		const responses = await sendMp(config.ga4, body, config.ga4Debug);
		const allOk = Object.values(responses).every(r => r.ok);
		await db
			.update(purchases)
			.set({
				ga4Attempts: sql`${purchases.ga4Attempts} + 1`,
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
			name: "refund",
			occurredAt: p.refundedAt,
			sessionId: p.gaSessionId,
			transactionId: p.transactionId,
			value,
		});
		const responses = await sendMp(config.ga4, body, config.ga4Debug);
		const allOk = Object.values(responses).every(r => r.ok);
		await db
			.update(purchases)
			.set({ refundResponseGa4: { payload: body, responses }, refundSentAt: allOk ? new Date() : null })
			.where(eq(purchases.id, p.id));
		report.refund = allOk ? "enviado" : "falhou";
	}

	return report;
}

/** Compras com envio pendente (para o reenvio automático). */
export async function pendingPurchaseIds(limit = 50): Promise<number[]> {
	const rows = await serviceDb().execute<{ id: number }>(sql`
    select id from purchases
    where not is_renewal and (
      status in ('approved', 'refund_requested')
      and (meta_sent_at is null and meta_attempts < ${MAX_ATTEMPTS} or ga4_sent_at is null and ga4_attempts < ${MAX_ATTEMPTS})
      and coalesce(occurred_at, created_at) > now() - interval '7 days'
    ) or (
      status in ('refunded', 'chargeback') and ga4_sent_at is not null and refund_sent_at is null
      and updated_at > now() - interval '7 days'
    )
    order by id
    limit ${limit}`);
	return rows.rows.map(r => Number(r.id));
}
