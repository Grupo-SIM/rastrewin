import { z } from "zod";
import { TRCK_ID } from "@/lib/tracking/schemas";

/*
 * Contrato do webhook "Central de produtos digitais — API de vendas" do SimIntPay
 * (Grupo-SIM/simintpay: docs/central-sales-api.md e platform-sales-events.service.ts).
 * Valores em CENTAVOS; sem campo de moeda; sem CPF.
 */

export const SALES_EVENTS = [
	"purchase_approved",
	"purchase_refunded",
	"chargeback",
	"refund_requested",
	"card_declined",
	"pix_generated",
	"pix_expired",
] as const;
export type SalesEventType = (typeof SALES_EVENTS)[number];

const optStr = (max: number) =>
	z
		.string()
		.max(max)
		.nullish()
		.transform(v => (v?.trim() ? v.trim() : null));

export const salesEventSchema = z
	.object({
		amountCents: z.number().nonnegative().max(1e11),
		customerEmail: optStr(254),
		customerName: optStr(200),
		event: z.enum(SALES_EVENTS),
		eventId: z.string().min(8).max(128),
		items: z
			.array(
				z
					.object({
						offerId: z.string().max(128).nullish(),
						tipo: z.string().max(40).nullish(),
						titulo: z.string().max(300).nullish(),
						valor: z.number().nonnegative().max(1e9).nullish(),
					})
					.passthrough(),
			)
			.max(50)
			.nullish(),
		linkId: optStr(128),
		netAmountCents: z.number().nonnegative().max(1e11).nullish(),
		occurredAt: z.iso.datetime({ offset: true }),
		orderId: z.string().min(1).max(128),
		paymentMethod: optStr(40),
		phone: optStr(40),
		/** Enviado pelo backend do rastrewin: plano do cadastro (basico, pro, vip), id do item principal. */
		plan: z
			.string()
			.regex(/^[a-z0-9_-]{1,40}$/)
			.nullish()
			.catch(null),
		/** Enviado pelo backend do rastrewin: recompra de quem já tinha pago (não vai à Meta/GA4). */
		renewal: z.boolean().nullish(),
		tracking: z.record(z.string(), z.string().max(500)).nullish(),
	})
	.passthrough();
export type SalesEvent = z.infer<typeof salesEventSchema>;

export type PurchaseStatus =
	"approved" | "refunded" | "chargeback" | "refund_requested" | "declined" | "pending" | "expired";

export function mapStatus(event: SalesEventType): PurchaseStatus {
	switch (event) {
		case "purchase_approved":
			return "approved";
		case "purchase_refunded":
			return "refunded";
		case "chargeback":
			return "chargeback";
		case "refund_requested":
			return "refund_requested";
		case "card_declined":
			return "declined";
		case "pix_generated":
			return "pending";
		case "pix_expired":
			return "expired";
	}
}

/** Precedência: um evento atrasado nunca "desfaz" um estado mais avançado (ex.: reembolso). */
export function statusRank(status: string): number {
	if (status === "refunded" || status === "chargeback") return 3;
	if (status === "approved" || status === "refund_requested") return 2;
	return 1;
}

export function nextStatus(current: string | null | undefined, incoming: PurchaseStatus): string {
	if (!current) return incoming;
	return statusRank(incoming) >= statusRank(current) ? incoming : current;
}

/**
 * Depois que a venda foi aprovada, só uma NOVA aprovação pode mudar seus dados (valor, produto, UTMs,
 * visitante). Os demais eventos (reembolso, chargeback, pedido de reembolso, PIX...) mudam apenas o
 * status e a data do reembolso: o valor que eles trazem não regrava a receita, e o tracking que o
 * backend anexa a eles (o do cadastro, possivelmente mais novo) não troca a origem da venda.
 */
export function postApprovalOnly(existingApprovedAt: Date | null | undefined, incoming: PurchaseStatus) {
	return !!existingApprovedAt && incoming !== "approved";
}

/** Venda válida para enviar Purchase (aprovada ou em mediação). */
export function isSaleActive(status: string) {
	return status === "approved" || status === "refund_requested";
}

export function isRefunded(status: string) {
	return status === "refunded" || status === "chargeback";
}

/** A Meta aceita event_time de até 7 dias atrás. */
export const META_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/**
 * Avisos do SimIntPay que viram AddPaymentInfo na Meta: a pessoa chegou a informar o pagamento.
 * O SimIntPay não avisa "cartão informado": o cartão aprovado de primeira só manda purchase_approved,
 * então a aprovação também gera o AddPaymentInfo quando o pedido ainda não teve um (o id
 * addpaymentinfo_<pedido> garante um por pedido). Isso cobre também o Pix cujo pix_generated chega
 * depois da aprovação.
 */
export const ADD_PAYMENT_INFO_EVENTS: readonly SalesEventType[] = [
	"pix_generated",
	"card_declined",
	"purchase_approved",
];

/**
 * Motivo para NÃO enviar AddPaymentInfo (null = envia). Uma vez por pedido, decidido depois de gravar
 * o aviso: status já com a precedência aplicada (pedido aprovado ou reembolsado não volta a "pendente").
 * Na aprovação, a venda precisa estar ativa; nos outros avisos, o pedido ainda não pode estar aprovado.
 */
export function addPaymentInfoSkipReason(input: {
	event: SalesEventType;
	status: string;
	isRenewal: boolean;
	marketingConsent: boolean | null;
	trckUserId: string | null;
	occurredAt: Date;
	now?: Date;
}): string | null {
	if (!ADD_PAYMENT_INFO_EVENTS.includes(input.event)) return "não é Pix gerado nem cartão recusado";
	if (input.isRenewal) return "renovação";
	if (input.event === "purchase_approved") {
		if (!isSaleActive(input.status)) return "venda não está ativa";
	} else if (input.status !== "pending" && input.status !== "declined") {
		return "pedido já aprovado ou encerrado";
	}
	// LGPD: só com aceite de marketing do visitante ligado à venda (o evento precisa do visitante).
	if (input.marketingConsent !== true || !input.trckUserId) return "sem consentimento";
	if ((input.now ?? new Date()).getTime() - input.occurredAt.getTime() > META_MAX_AGE_MS)
		return "fora do prazo";
	return null;
}

/**
 * Meio de pagamento do AddPaymentInfo para a Meta (`custom_data.payment_method`), a partir do que o
 * SimIntPay informa no aviso: `pix` ou `credit_card` (os públicos "Pix gerado sem compra" e "Cartão
 * recusado sem compra" filtram por ele). Outro meio ou sem meio: o campo não é enviado.
 */
const META_PAYMENT_METHODS: Record<string, "pix" | "credit_card"> = {
	CREDIT_CARD: "credit_card",
	PIX: "pix",
};

export function metaPaymentMethod(method: string | null | undefined): "pix" | "credit_card" | null {
	return META_PAYMENT_METHODS[method?.trim().toUpperCase() ?? ""] ?? null;
}

const FB_COOKIE = /^fb\.\d\.\d{10,13}\.[\w.-]+$/;

export interface PurchaseItem {
	id: string;
	name: string;
	price: number;
	type: string | null;
}

/** Campos da compra derivados do payload (sem consulta ao banco). */
export function toPurchaseFields(p: SalesEvent) {
	const tracking = p.tracking ?? {};
	const pick = (k: string) => (tracking[k]?.trim() ? tracking[k].trim().slice(0, 500) : null);
	const principal = (p.items ?? []).find(it => it.tipo === "PRINCIPAL") ?? p.items?.[0];
	// O plano do cadastro (basico, pro, vip), repassado pelo backend, é o id do item principal: o mesmo
	// content_id do InitiateCheckout do site, para a Meta e o GA4 ligarem o funil ao mesmo produto.
	const plan = p.plan ?? null;
	const items: PurchaseItem[] = (p.items ?? []).map((it, i) => ({
		id:
			(plan && it === principal ? plan : null) ??
			it.offerId ??
			it.titulo ??
			`${p.linkId ?? "item"}-${i + 1}`,
		name: it.titulo ?? "Produto",
		price: it.valor ?? 0,
		type: it.tipo ?? null,
	}));
	if (!items.length && plan)
		items.push({ id: plan, name: "Produto", price: Math.round(p.amountCents) / 100, type: null });
	const src = pick("src");
	const utm = {
		utmCampaign: pick("utm_campaign"),
		utmContent: pick("utm_content"),
		utmMedium: pick("utm_medium"),
		utmSource: pick("utm_source"),
		utmTerm: pick("utm_term"),
	};
	// LGPD: recusa do banner na visita da compra, informada pelo site no cadastro e repassada pelo
	// backend. Vale mais que qualquer aceite antigo encontrado pelo src, e-mail ou telefone.
	const consentRejected = pick("consent") === "rejected";
	return {
		consentRejected,
		fbc: !consentRejected && pick("fbc") && FB_COOKIE.test(pick("fbc")!) ? pick("fbc") : null,
		fbclid: consentRejected ? null : pick("fbclid"),
		fbp: !consentRejected && pick("fbp") && FB_COOKIE.test(pick("fbp")!) ? pick("fbp") : null,
		hasUtm: Object.values(utm).some(Boolean),
		isRenewal: p.renewal === true,
		items,
		netValue:
			p.netAmountCents === null || p.netAmountCents === undefined
				? null
				: (Math.round(p.netAmountCents) / 100).toFixed(2),
		occurredAt: new Date(p.occurredAt),
		paymentMethod: p.paymentMethod,
		product: principal?.titulo ?? null,
		src,
		status: mapStatus(p.event),
		transactionId: p.orderId,
		/** trck_user_id só se o src tiver o formato do nosso ID (e nunca com recusa do banner) */
		trckUserIdFromSrc: !consentRejected && src && TRCK_ID.test(src) ? src : null,
		utm,
		value: (Math.round(p.amountCents) / 100).toFixed(2),
	};
}
