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
    .transform((v) => (v?.trim() ? v.trim() : null));

export const salesEventSchema = z
  .object({
    eventId: z.string().min(8).max(128),
    occurredAt: z.iso.datetime({ offset: true }),
    event: z.enum(SALES_EVENTS),
    orderId: z.string().min(1).max(128),
    linkId: optStr(128),
    amountCents: z.number().nonnegative().max(1e11),
    netAmountCents: z.number().nonnegative().max(1e11).nullish(),
    paymentMethod: optStr(40),
    phone: optStr(40),
    customerEmail: optStr(254),
    customerName: optStr(200),
    tracking: z.record(z.string(), z.string().max(500)).nullish(),
    items: z
      .array(
        z
          .object({
            tipo: z.string().max(40).nullish(),
            offerId: z.string().max(128).nullish(),
            titulo: z.string().max(300).nullish(),
            valor: z.number().nonnegative().max(1e9).nullish(),
          })
          .passthrough(),
      )
      .max(50)
      .nullish(),
  })
  .passthrough();
export type SalesEvent = z.infer<typeof salesEventSchema>;

export type PurchaseStatus =
  | "approved"
  | "refunded"
  | "chargeback"
  | "refund_requested"
  | "declined"
  | "pending"
  | "expired";

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

/** Venda válida para enviar Purchase (aprovada ou em mediação). */
export function isSaleActive(status: string) {
  return status === "approved" || status === "refund_requested";
}

export function isRefunded(status: string) {
  return status === "refunded" || status === "chargeback";
}

const FB_COOKIE = /^fb\.\d\.\d{10,13}\.[\w.-]+$/;

export type PurchaseItem = { id: string; name: string; price: number; type: string | null };

/** Campos da compra derivados do payload (sem consulta ao banco). */
export function toPurchaseFields(p: SalesEvent) {
  const tracking = p.tracking ?? {};
  const pick = (k: string) => (tracking[k]?.trim() ? tracking[k].trim().slice(0, 500) : null);
  const items: PurchaseItem[] = (p.items ?? []).map((it, i) => ({
    id: it.offerId ?? it.titulo ?? `${p.linkId ?? "item"}-${i + 1}`,
    name: it.titulo ?? "Produto",
    price: it.valor ?? 0,
    type: it.tipo ?? null,
  }));
  const principal = (p.items ?? []).find((it) => it.tipo === "PRINCIPAL") ?? p.items?.[0];
  const src = pick("src");
  const utm = {
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmTerm: pick("utm_term"),
    utmContent: pick("utm_content"),
  };
  return {
    transactionId: p.orderId,
    status: mapStatus(p.event),
    value: (Math.round(p.amountCents) / 100).toFixed(2),
    netValue: p.netAmountCents === null || p.netAmountCents === undefined ? null : (Math.round(p.netAmountCents) / 100).toFixed(2),
    paymentMethod: p.paymentMethod,
    product: principal?.titulo ?? null,
    items,
    src,
    /** trck_user_id só se o src tiver o formato do nosso ID */
    trckUserIdFromSrc: src && TRCK_ID.test(src) ? src : null,
    utm,
    hasUtm: Object.values(utm).some(Boolean),
    fbc: pick("fbc") && FB_COOKIE.test(pick("fbc")!) ? pick("fbc") : null,
    fbp: pick("fbp") && FB_COOKIE.test(pick("fbp")!) ? pick("fbp") : null,
    fbclid: pick("fbclid"),
    occurredAt: new Date(p.occurredAt),
  };
}
