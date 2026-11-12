import "server-only";
import { z } from "zod";
import { readJsonBody } from "@/lib/http/body";
import { rateLimitKey } from "@/lib/http/client-ip";
import { json } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { verifySignature } from "@/lib/sales/signature";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import type { Subject } from "./subject";

/*
 * Pedidos de ACESSO/EXCLUSÃO vindos do backend do rastrewin (server-to-server), depois que a pessoa
 * confirmou o email. Mesmo segredo e assinatura das vendas (x-simintpay-signature = HMAC-SHA256 do
 * corpo). O corpo diz a ação (o mesmo corpo assinado não serve na outra rota) e a hora do envio
 * (pedido com mais de 5 min é recusado, contra reenvio de uma requisição capturada).
 */

const limiter = createRateLimiter({ burst: 10, perMinute: 20 });
const MAX_BYTES = 2 * 1024;
const MAX_AGE_MS = 5 * 60_000;

const requestSchema = z
	.object({
		action: z.enum(["export", "erase"]),
		email: z.string().trim().max(254).nullish(),
		phone: z.string().trim().max(40).nullish(),
		sent_at: z.iso.datetime({ offset: true }),
	})
	.refine(d => d.email || d.phone, "informe email ou telefone");

export async function readSignedPrivacyRequest(
	request: Request,
	action: "export" | "erase",
): Promise<{ ok: true; subject: Subject } | { ok: false; response: Response }> {
	const fail = (body: unknown, status: number) => ({ ok: false as const, response: json(body, status) });
	if (!limiter.take(rateLimitKey(request.headers))) return fail({ error: "muitas requisições" }, 429);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return fail({ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" }, body.status);

	const config = await getRuntimeConfig();
	if (!config.webhookSecret) return fail({ error: "webhook ainda não configurado" }, 503);
	if (!verifySignature(body.raw, request.headers.get("x-simintpay-signature"), config.webhookSecret))
		return fail({ error: "assinatura inválida" }, 401);

	const parsed = requestSchema.safeParse(body.data);
	if (!parsed.success)
		return fail(
			{ error: "payload inválido", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
		);
	if (parsed.data.action !== action) return fail({ error: "ação não confere com a rota" }, 400);
	if (Math.abs(Date.now() - Date.parse(parsed.data.sent_at)) > MAX_AGE_MS)
		return fail({ error: "pedido fora do prazo" }, 400);

	return { ok: true, subject: { email: parsed.data.email, phone: parsed.data.phone } };
}
