import "server-only";
import { eq } from "drizzle-orm";
import { eventsLog, purchases } from "@/db/schema";
import { readAsUser } from "@/lib/dal";

/** Detalhe de um evento (payload e resposta de Meta e GA4) — lido só quando o modal abre. */
export async function getEventDetail(id: number) {
	return readAsUser(async tx => {
		const [row] = await tx
			.select({
				createdAt: eventsLog.createdAt,
				eventId: eventsLog.eventId,
				eventName: eventsLog.eventName,
				eventSourceUrl: eventsLog.eventSourceUrl,
				id: eventsLog.id,
				ip: eventsLog.ip,
				payloadGa4: eventsLog.payloadGa4,
				payloadMeta: eventsLog.payloadMeta,
				responseGa4: eventsLog.responseGa4,
				responseMeta: eventsLog.responseMeta,
				trckUserId: eventsLog.trckUserId,
				userAgent: eventsLog.userAgent,
			})
			.from(eventsLog)
			.where(eq(eventsLog.id, id));
		return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
	});
}

/** Detalhe de uma compra: ligação, envios, respostas e o webhook bruto. */
export async function getPurchaseDetail(id: number) {
	return readAsUser(async tx => {
		const [row] = await tx
			.select({
				currency: purchases.currency,
				email: purchases.email,
				ga4Attempts: purchases.ga4Attempts,
				ga4SentAt: purchases.ga4SentAt,
				id: purchases.id,
				lastDeliveryError: purchases.lastDeliveryError,
				match: purchases.match,
				metaAttempts: purchases.metaAttempts,
				metaSentAt: purchases.metaSentAt,
				netValue: purchases.netValue,
				occurredAt: purchases.occurredAt,
				payloadGa4: purchases.payloadGa4,
				payloadMeta: purchases.payloadMeta,
				paymentMethod: purchases.paymentMethod,
				product: purchases.product,
				refundedAt: purchases.refundedAt,
				refundResponseGa4: purchases.refundResponseGa4,
				refundSentAt: purchases.refundSentAt,
				responseGa4: purchases.responseGa4,
				responseMeta: purchases.responseMeta,
				status: purchases.status,
				transactionId: purchases.transactionId,
				trckUserId: purchases.trckUserId,
				utmCampaign: purchases.utmCampaign,
				utmContent: purchases.utmContent,
				utmMedium: purchases.utmMedium,
				utmSource: purchases.utmSource,
				utmTerm: purchases.utmTerm,
				value: purchases.value,
				webhookRaw: purchases.webhookRaw,
			})
			.from(purchases)
			.where(eq(purchases.id, id));
		if (!row) return null;
		const iso = (d: Date | null) => d?.toISOString() ?? null;
		return {
			...row,
			ga4SentAt: iso(row.ga4SentAt),
			metaSentAt: iso(row.metaSentAt),
			netValue: row.netValue === null ? null : Number(row.netValue),
			occurredAt: iso(row.occurredAt),
			refundedAt: iso(row.refundedAt),
			refundSentAt: iso(row.refundSentAt),
			value: Number(row.value),
		};
	});
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
export type PurchaseDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseDetail>>>;
