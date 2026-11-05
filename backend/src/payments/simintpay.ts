import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Webhook assinado da "API de vendas" do SimIntPay (Grupo-SIM/simintpay: docs/central-sales-api.md).
 * Assinatura: HMAC-SHA256 hexadecimal dos bytes EXATOS do corpo, no header x-simintpay-signature,
 * com o WEBHOOK_SECRET da plataforma (aqui SIMPAY_WEBHOOK_SECRET). Valores em centavos, sem CPF.
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

/** Campos que o backend usa. O objeto original (com todos os campos) é o que vai para o track. */
export interface SalesEvent {
	eventId: string;
	event: SalesEventType;
	orderId: string;
	occurredAt: string;
	amountCents: number;
	customerEmail: string | null;
	tracking: Record<string, string> | null;
}

export function signBody(body: Buffer | string, secret: string): string {
	return createHmac("sha256", secret).update(body).digest("hex");
}

/** Sem segredo configurado, nunca aceita. Comparação em tempo constante. */
export function isValidSignature(
	body: Buffer | undefined,
	signature: string | undefined,
	secret: string | undefined,
): boolean {
	if (!body || !signature || !secret) return false;
	const expected = Buffer.from(signBody(body, secret), "utf8");
	const received = Buffer.from(signature.trim().toLowerCase(), "utf8");
	return expected.length === received.length && timingSafeEqual(expected, received);
}

const isStr = (v: unknown, max: number): v is string =>
	typeof v === "string" && v.length > 0 && v.length <= max;

/** Valida o mínimo do contrato. Devolve null se o payload não for um evento de venda válido. */
export function parseSalesEvent(raw: unknown): SalesEvent | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const p = raw as Record<string, unknown>;
	if (!isStr(p.eventId, 128) || p.eventId.length < 8) return null;
	if (!isStr(p.event, 40) || !(SALES_EVENTS as readonly string[]).includes(p.event)) return null;
	if (!isStr(p.orderId, 128)) return null;
	if (!isStr(p.occurredAt, 40) || Number.isNaN(Date.parse(p.occurredAt))) return null;
	if (typeof p.amountCents !== "number" || !Number.isFinite(p.amountCents) || p.amountCents < 0)
		return null;
	const email = typeof p.customerEmail === "string" ? p.customerEmail.trim().toLowerCase() : "";
	const tracking =
		p.tracking && typeof p.tracking === "object" && !Array.isArray(p.tracking)
			? Object.fromEntries(
					Object.entries(p.tracking as Record<string, unknown>).filter(
						(e): e is [string, string] => typeof e[1] === "string",
					),
				)
			: null;
	return {
		amountCents: p.amountCents,
		customerEmail: email || null,
		event: p.event as SalesEventType,
		eventId: p.eventId,
		occurredAt: p.occurredAt,
		orderId: p.orderId,
		tracking,
	};
}
