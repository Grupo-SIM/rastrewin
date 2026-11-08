import { recordRelayStatus, relayStatusSchema } from "@/lib/health/relay";
import { readJsonBody } from "@/lib/http/body";
import { rateLimitKey } from "@/lib/http/client-ip";
import { json } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { verifySignature } from "@/lib/sales/signature";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";

/*
 * POST /api/webhook/relay-status — sinal do backend sobre a fila de repasse de vendas (server-to-server).
 * Mesmo segredo e mesma assinatura das vendas (x-simintpay-signature = HMAC-SHA256 do corpo).
 * Só contagens e erros técnicos. Sinal com mais de 10 min (reenviado/atrasado) é recusado.
 * A resposta leva `retry_failed: true` quando alguém pediu "Tentar de novo" na aba Saúde.
 */

const limiter = createRateLimiter({ burst: 10, perMinute: 20 });
const MAX_BYTES = 16 * 1024;
const MAX_AGE_MS = 10 * 60_000;

export async function POST(request: Request) {
	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json({ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" }, body.status);

	const config = await getRuntimeConfig();
	if (!config.webhookSecret) return json({ error: "webhook ainda não configurado" }, 503);
	if (!verifySignature(body.raw, request.headers.get("x-simintpay-signature"), config.webhookSecret))
		return json({ error: "assinatura inválida" }, 401);

	const parsed = relayStatusSchema.safeParse(body.data);
	if (!parsed.success)
		return json(
			{ error: "payload inválido", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
		);
	if (Math.abs(Date.now() - Date.parse(parsed.data.sent_at)) > MAX_AGE_MS)
		return json({ error: "sinal fora do prazo" }, 400);

	const { retryFailed } = recordRelayStatus(parsed.data);
	return json({ ok: true, retry_failed: retryFailed }, 200);
}
