import { safeErrorMessage } from "@/lib/errors";
import { readJsonBody } from "@/lib/http/body";
import { clientIp, rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { recordConsent } from "@/lib/privacy/consent";
import { botReason } from "@/lib/tracking/bot-guard";
import { consentSchema } from "@/lib/tracking/schemas";

/*
 * POST /api/consent — escolha feita no banner de consentimento do t.js (LGPD).
 * Grava a prova (consent_records: id aleatório da escolha, versão do texto, página; sem IP nem navegador)
 * e aplica no visitante. Mesma proteção dos outros endpoints públicos: origem → rate limit → corpo → Zod.
 */

const limiter = createRateLimiter({ burst: 10, perMinute: 20 });
const MAX_BYTES = 2 * 1024;

export function OPTIONS(request: Request) {
	return preflight(request);
}

export async function POST(request: Request) {
	const origin = await allowedOrigin(request);
	if (!origin) return json({ error: "origem não autorizada" }, 403);
	const cors = corsHeaders(origin);

	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, cors);
	if (botReason(clientIp(request.headers), request.headers.get("user-agent")))
		return json({ ignored: true, ok: true }, 200, cors);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json(
			{ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" },
			body.status,
			cors,
		);

	const parsed = consentSchema.safeParse(body.data);
	if (!parsed.success)
		return json(
			{ error: "dados inválidos", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
			cors,
		);
	if (parsed.data.wd) return json({ ignored: true, ok: true }, 200, cors);

	try {
		await recordConsent(parsed.data, origin);
	} catch (error) {
		console.error(`[consent] falha ao gravar: ${safeErrorMessage(error)}`);
		return json({ error: "falha ao gravar" }, 500, cors);
	}
	return json({ ok: true }, 200, cors);
}
