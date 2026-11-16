import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db";
import { eventsLog, purchases, visitors } from "@/db/schema";
import { safeErrorMessage } from "@/lib/errors";
import { buildEvent, sendToPixels } from "@/lib/meta/capi";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { itemsOf, saleCustomData, salePerson, saleSourceUrl } from "./deliver";
import { addPaymentInfoSkipReason, type SalesEventType } from "./simintpay";

/*
 * AddPaymentInfo (evento padrão da Meta) quando o SimIntPay avisa "Pix gerado" ou "cartão recusado":
 * a pessoa chegou a informar o pagamento. Sai pelo servidor (CAPI), só para a Meta (não vai ao GA4),
 * uma vez por pedido: o event_id addpaymentinfo_<pedido> é único em events_log, que também mostra o
 * evento no painel (Eventos e jornada do visitante). Mesmos dados de correspondência do Purchase.
 * Uma tentativa só, como os eventos do site; a falha fica registrada na resposta da Meta do evento.
 */

export async function deliverAddPaymentInfo(
	purchaseId: number,
	webhookEvent: SalesEventType,
	occurredAt: Date,
): Promise<string> {
	const db = serviceDb();
	const [p] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
	if (!p) return "venda não encontrada";
	const skip = addPaymentInfoSkipReason({
		event: webhookEvent,
		isRenewal: p.isRenewal,
		marketingConsent: p.marketingConsent,
		occurredAt,
		status: p.status,
		trckUserId: p.trckUserId,
	});
	if (skip) return skip;
	const trckUserId = p.trckUserId as string;

	const config = await getRuntimeConfig();
	const [visitor] = await db.select().from(visitors).where(eq(visitors.trckUserId, trckUserId)).limit(1);
	if (!visitor) return "visitante não encontrado";

	const eventId = `addpaymentinfo_${p.transactionId}`;
	const customData = saleCustomData(p, itemsOf(p));
	const eventSourceUrl = saleSourceUrl(visitor, config.allowedOrigins);
	const [row] = await db
		.insert(eventsLog)
		.values({
			createdAt: occurredAt,
			currency: p.currency,
			eventId,
			eventName: "AddPaymentInfo",
			eventSourceUrl,
			geoCity: p.geoCity,
			geoCountry: p.geoCountry,
			geoRegion: p.geoRegion,
			ip: visitor.ip,
			payloadGa4: { skipped: "evento do servidor (webhook) só para a Meta; não vai ao GA4" },
			trckUserId,
			userAgent: visitor.userAgent,
			utmCampaign: p.utmCampaign,
			utmContent: p.utmContent,
			utmMedium: p.utmMedium,
			utmSource: p.utmSource,
			utmTerm: p.utmTerm,
			value: p.value,
		})
		.onConflictDoNothing({ target: eventsLog.eventId })
		.returning({ id: eventsLog.id });
	if (!row) return "já enviado";

	if (!config.pixels.length) {
		await db
			.update(eventsLog)
			.set({ responseMeta: { skipped: "nenhum pixel ativo" } })
			.where(eq(eventsLog.id, row.id));
		return "nenhum pixel ativo";
	}
	const event = buildEvent({
		actionSource: visitor.userAgent ? "website" : "system_generated",
		customData,
		eventId,
		eventName: "AddPaymentInfo",
		eventSourceUrl,
		eventTime: occurredAt,
		person: salePerson(p, visitor, occurredAt),
	});
	try {
		const { payload, responses } = await sendToPixels(config.pixels, event, config.testEventCode);
		await db
			.update(eventsLog)
			.set({ payloadMeta: payload, responseMeta: responses })
			.where(eq(eventsLog.id, row.id));
		return Object.values(responses).every(r => r.ok) ? "enviado" : "falhou";
	} catch (error) {
		console.error("[capi] falha ao enviar AddPaymentInfo", eventId, safeErrorMessage(error));
		await db
			.update(eventsLog)
			.set({ payloadMeta: { data: [event] }, responseMeta: { error: "falha interna no envio" } })
			.where(eq(eventsLog.id, row.id));
		return "falhou";
	}
}
