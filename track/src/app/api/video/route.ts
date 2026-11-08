import { safeErrorMessage } from "@/lib/errors";
import { lookupGeo } from "@/lib/geo";
import { readJsonBody } from "@/lib/http/body";
import { clientIp, rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { botReason } from "@/lib/tracking/bot-guard";
import { videoSchema } from "@/lib/tracking/schemas";
import { recordVideoView } from "@/lib/tracking/videos";

/*
 * POST /api/video — progresso de um play (comando trck('video') do site), para a aba Vídeos.
 * Só grava o resumo em video_views. NÃO é evento: não vai à Meta, ao GA4 nem ao events_log.
 * Mesmas proteções das outras rotas públicas: origem autorizada → rate limit → robôs → corpo → Zod.
 * O site manda ~1 envio a cada 15 s tocando, então o limite próprio fica bem acima disso.
 */

const limiter = createRateLimiter({ burst: 10, perMinute: 30 });
const MAX_BYTES = 2 * 1024;

export function OPTIONS(request: Request) {
	return preflight(request);
}

export async function POST(request: Request) {
	const origin = await allowedOrigin(request);
	if (!origin) return json({ error: "origem não autorizada" }, 403);
	const cors = corsHeaders(origin);

	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, cors);

	const ip = clientIp(request.headers);
	if (botReason(ip, request.headers.get("user-agent"))) return json({ ignored: true, ok: true }, 200, cors);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json(
			{ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" },
			body.status,
			cors,
		);

	const parsed = videoSchema.safeParse(body.data);
	if (!parsed.success)
		return json(
			{ error: "dados inválidos", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
			cors,
		);

	if (parsed.data.wd) return json({ ignored: true, ok: true }, 200, cors);

	try {
		await recordVideoView(parsed.data, lookupGeo(ip));
	} catch (error) {
		console.error(`[video] falha ao gravar: ${safeErrorMessage(error)}`);
		return json({ error: "falha ao gravar" }, 500, cors);
	}
	return json({ ok: true }, 202, cors);
}
