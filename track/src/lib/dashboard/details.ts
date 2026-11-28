import "server-only";
import { eq } from "drizzle-orm";
import { eventsLog, ga4Accounts, metaPixels, purchases, visitors } from "@/db/schema";
import { isAdmin, readAsUser } from "@/lib/dal";
import { maskEmail, maskIp, redactPersonal } from "@/lib/privacy/mask";
import { canResend, type DeliveryInput, deliveryState } from "@/lib/sales/delivery-state";
import { isSaleActive } from "@/lib/sales/simintpay";

/*
 * Colaborador (src/lib/roles.ts): IP e e-mail mascarados, identificadores dos payloads como "oculto"
 * e webhook bruto omitido (webhookHidden). Feito aqui, no servidor (src/lib/privacy/mask.ts).
 */

/** Detalhe de um evento (payload e resposta de Meta e GA4) — lido só quando o modal abre. */
export async function getEventDetail(id: number) {
	const admin = await isAdmin();
	const detail = await readAsUser(async tx => {
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
	if (!detail || admin) return detail;
	return {
		...detail,
		ip: maskIp(detail.ip),
		payloadGa4: redactPersonal(detail.payloadGa4),
		payloadMeta: redactPersonal(detail.payloadMeta),
	};
}

/** Detalhe de uma compra: ligação, envios, respostas e o webhook bruto (só Administrador). */
export async function getPurchaseDetail(id: number) {
	const admin = await isAdmin();
	const detail = await readAsUser(async tx => {
		const [row] = await tx
			.select({
				affiliateCode: purchases.affiliateCode,
				affiliateCommission: purchases.affiliateCommission,
				affiliateName: purchases.affiliateName,
				createdAt: purchases.createdAt,
				currency: purchases.currency,
				email: purchases.email,
				ga4Attempts: purchases.ga4Attempts,
				ga4SentAt: purchases.ga4SentAt,
				id: purchases.id,
				isRenewal: purchases.isRenewal,
				lastDeliveryError: purchases.lastDeliveryError,
				marketingConsent: purchases.marketingConsent,
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

		// Situação de cada envio (calendário do reenvio, retry-schedule.ts) e se dá para reenviar agora.
		const [visitor] = row.trckUserId
			? await tx
					.select({ isTest: visitors.isTest })
					.from(visitors)
					.where(eq(visitors.trckUserId, row.trckUserId))
					.limit(1)
			: [];
		const [pixel] = await tx
			.select({ id: metaPixels.id })
			.from(metaPixels)
			.where(eq(metaPixels.active, true))
			.limit(1);
		const [ga4] = await tx
			.select({ id: ga4Accounts.id })
			.from(ga4Accounts)
			.where(eq(ga4Accounts.active, true))
			.limit(1);
		const common = {
			active: isSaleActive(row.status),
			consent: row.marketingConsent === true,
			isRenewal: row.isRenewal,
			isTest: visitor?.isTest === true,
			now: new Date(),
			saleAt: row.occurredAt ?? row.createdAt,
		} satisfies Partial<DeliveryInput>;
		const meta = deliveryState({
			...common,
			attempts: row.metaAttempts,
			destination: "meta",
			hasAccount: !!pixel,
			sentAt: row.metaSentAt,
		});
		const ga4State = deliveryState({
			...common,
			attempts: row.ga4Attempts,
			destination: "ga4",
			hasAccount: !!ga4,
			sentAt: row.ga4SentAt,
		});
		const { createdAt: _createdAt, isRenewal: _isRenewal, ...fields } = row;
		return {
			...fields,
			affiliateCommission: row.affiliateCommission === null ? null : Number(row.affiliateCommission),
			delivery: {
				/** Só o Administrador vê o botão (a action confere de novo). */
				canResend: canResend(meta, !!pixel) || canResend(ga4State, !!ga4),
				ga4: ga4State,
				meta,
			},
			ga4SentAt: iso(row.ga4SentAt),
			metaSentAt: iso(row.metaSentAt),
			netValue: row.netValue === null ? null : Number(row.netValue),
			occurredAt: iso(row.occurredAt),
			refundedAt: iso(row.refundedAt),
			refundSentAt: iso(row.refundSentAt),
			value: Number(row.value),
			webhookHidden: false,
		};
	});
	if (!detail || admin) return detail;
	return {
		...detail,
		delivery: { ...detail.delivery, canResend: false },
		email: maskEmail(detail.email),
		payloadGa4: redactPersonal(detail.payloadGa4),
		payloadMeta: redactPersonal(detail.payloadMeta),
		webhookHidden: true,
		webhookRaw: null,
	};
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
export type PurchaseDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseDetail>>>;
