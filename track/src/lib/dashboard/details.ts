import "server-only";
import { eq } from "drizzle-orm";
import { eventsLog, purchases } from "@/db/schema";
import { readAsUser } from "@/lib/dal";

/** Detalhe de um evento (payload e resposta de Meta e GA4) — lido só quando o modal abre. */
export async function getEventDetail(id: number) {
  return readAsUser(async (tx) => {
    const [row] = await tx
      .select({
        id: eventsLog.id,
        eventName: eventsLog.eventName,
        eventId: eventsLog.eventId,
        trckUserId: eventsLog.trckUserId,
        eventSourceUrl: eventsLog.eventSourceUrl,
        createdAt: eventsLog.createdAt,
        ip: eventsLog.ip,
        userAgent: eventsLog.userAgent,
        payloadMeta: eventsLog.payloadMeta,
        responseMeta: eventsLog.responseMeta,
        payloadGa4: eventsLog.payloadGa4,
        responseGa4: eventsLog.responseGa4,
      })
      .from(eventsLog)
      .where(eq(eventsLog.id, id));
    return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  });
}

/** Detalhe de uma compra: ligação, envios, respostas e o webhook bruto. */
export async function getPurchaseDetail(id: number) {
  return readAsUser(async (tx) => {
    const [row] = await tx
      .select({
        id: purchases.id,
        transactionId: purchases.transactionId,
        status: purchases.status,
        value: purchases.value,
        netValue: purchases.netValue,
        currency: purchases.currency,
        product: purchases.product,
        email: purchases.email,
        paymentMethod: purchases.paymentMethod,
        trckUserId: purchases.trckUserId,
        match: purchases.match,
        utmSource: purchases.utmSource,
        utmMedium: purchases.utmMedium,
        utmCampaign: purchases.utmCampaign,
        utmTerm: purchases.utmTerm,
        utmContent: purchases.utmContent,
        occurredAt: purchases.occurredAt,
        refundedAt: purchases.refundedAt,
        metaSentAt: purchases.metaSentAt,
        ga4SentAt: purchases.ga4SentAt,
        refundSentAt: purchases.refundSentAt,
        metaAttempts: purchases.metaAttempts,
        ga4Attempts: purchases.ga4Attempts,
        lastDeliveryError: purchases.lastDeliveryError,
        payloadMeta: purchases.payloadMeta,
        responseMeta: purchases.responseMeta,
        payloadGa4: purchases.payloadGa4,
        responseGa4: purchases.responseGa4,
        refundResponseGa4: purchases.refundResponseGa4,
        webhookRaw: purchases.webhookRaw,
      })
      .from(purchases)
      .where(eq(purchases.id, id));
    if (!row) return null;
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    return {
      ...row,
      value: Number(row.value),
      netValue: row.netValue === null ? null : Number(row.netValue),
      occurredAt: iso(row.occurredAt),
      refundedAt: iso(row.refundedAt),
      metaSentAt: iso(row.metaSentAt),
      ga4SentAt: iso(row.ga4SentAt),
      refundSentAt: iso(row.refundSentAt),
    };
  });
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
export type PurchaseDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseDetail>>>;
