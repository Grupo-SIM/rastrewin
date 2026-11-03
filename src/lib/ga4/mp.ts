import { createHash } from "node:crypto";
import { GA4_MP_COLLECT_URL, GA4_MP_DEBUG_URL } from "./endpoints";

/*
 * GA4 Measurement Protocol — usado SÓ para o evento que nasce fora do navegador
 * (compra/reembolso do webhook). Os eventos do site vão pela gtag.
 * Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

export type MpItem = { item_id: string; item_name: string; price: number; quantity: number; item_category?: string };
export type MpBody = {
  client_id: string;
  timestamp_micros?: number;
  events: { name: string; params: Record<string, unknown> }[];
};

/** O MP aceita eventos de até 72 h atrás; usamos 71 h de margem. */
const MAX_BACKDATE_MS = 71 * 3600 * 1000;

/** client_id estável derivado do transaction_id, para vendas sem visitante (sem _ga). */
export function syntheticClientId(transactionId: string): string {
  const hex = createHash("sha256").update(`rastrewin:${transactionId}`).digest("hex");
  return `${parseInt(hex.slice(0, 8), 16)}.${parseInt(hex.slice(8, 16), 16)}`;
}

export function buildMpBody(input: {
  name: "purchase" | "refund";
  clientId: string | null;
  transactionId: string;
  sessionId?: string | null;
  occurredAt?: Date | null;
  value: number;
  currency: string;
  items?: MpItem[];
  debug?: boolean;
  now?: Date;
}): MpBody {
  const now = input.now ?? new Date();
  const ts = input.occurredAt && now.getTime() - input.occurredAt.getTime() < MAX_BACKDATE_MS ? input.occurredAt : null;
  const params: Record<string, unknown> = {
    transaction_id: input.transactionId,
    value: input.value,
    currency: input.currency,
    engagement_time_msec: 1,
  };
  if (input.items?.length) params.items = input.items;
  if (input.sessionId) params.session_id = input.sessionId;
  if (input.debug) params.debug_mode = 1;
  return {
    client_id: input.clientId ?? syntheticClientId(input.transactionId),
    ...(ts ? { timestamp_micros: ts.getTime() * 1000 } : {}),
    events: [{ name: input.name, params }],
  };
}

export type MpDelivery = { ok: boolean; status: number; validationMessages?: unknown[]; error?: string };

async function post(url: URL, body: MpBody) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
}

/** Envia o mesmo corpo para cada propriedade GA4 ativa. Em modo debug, valida antes. */
export async function sendMp(
  accounts: { measurementId: string; apiSecret: string }[],
  body: MpBody,
  debug: boolean,
): Promise<Record<string, MpDelivery>> {
  const results = await Promise.all(
    accounts.map(async ({ measurementId, apiSecret }) => {
      const qs = (base: string) => {
        const url = new URL(base);
        url.searchParams.set("measurement_id", measurementId);
        url.searchParams.set("api_secret", apiSecret);
        return url;
      };
      try {
        let validationMessages: unknown[] | undefined;
        if (debug) {
          const v = await post(qs(GA4_MP_DEBUG_URL), body);
          validationMessages = ((await v.json().catch(() => ({}))) as { validationMessages?: unknown[] }).validationMessages ?? [];
        }
        const r = await post(qs(GA4_MP_COLLECT_URL), body);
        const delivery: MpDelivery = { ok: r.ok, status: r.status, ...(validationMessages ? { validationMessages } : {}) };
        return [measurementId, delivery] as const;
      } catch (error) {
        const timeout = error instanceof Error && error.name === "TimeoutError";
        return [measurementId, { ok: false, status: 0, error: timeout ? "tempo esgotado" : "falha de rede" }] as const;
      }
    }),
  );
  return Object.fromEntries(results);
}
