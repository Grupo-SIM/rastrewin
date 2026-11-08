import { lookupGeo } from "@/lib/geo";
import { readJsonBody } from "@/lib/http/body";
import { clientIp, rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { botReason, countIgnoredVisit } from "@/lib/tracking/bot-guard";
import { newTrckUserId } from "@/lib/tracking/ids";
import { cleanReferrer, ownHostsOf } from "@/lib/tracking/referrer";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { identifySchema } from "@/lib/tracking/schemas";
import { upsertVisitor } from "@/lib/tracking/visitors";

/*
 * POST /api/identify — UPSERT do visitante (público, chamado pelo /t.js).
 * Valida origem (CORS), rate limit por IP, tamanho e formato. IP, user agent e geo vêm do SERVIDOR.
 */

const limiter = createRateLimiter({ burst: 15, perMinute: 30 });
const MAX_BYTES = 8 * 1024;

export function OPTIONS(request: Request) {
	return preflight(request);
}

export async function POST(request: Request) {
	const origin = await allowedOrigin(request);
	if (!origin) return json({ error: "origem não autorizada" }, 403);
	const cors = corsHeaders(origin);

	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, cors);

	// Robô (rede da Meta/Google ou de nuvem, navegador de robô): não é cliente. Responde OK para o
	// t.js e não grava nem envia nada. O identify sai uma vez por página: é aqui que se conta.
	const bot = botReason(clientIp(request.headers), request.headers.get("user-agent"));
	if (bot) {
		countIgnoredVisit(bot);
		return json({ ignored: true, ok: true }, 200, cors);
	}

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json(
			{ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" },
			body.status,
			cors,
		);

	const parsed = identifySchema.safeParse(body.data);
	if (!parsed.success)
		return json(
			{ error: "dados inválidos", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
			cors,
		);
	const d = parsed.data;
	if (d.wd) {
		countIgnoredVisit("automacao");
		return json({ ignored: true, ok: true }, 200, cors);
	}

	const ip = clientIp(request.headers);
	const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
	const trckUserId = d.trck_user_id ?? newTrckUserId();
	// Origem sem UTM: só site externo, sem query (o próprio site e o checkout não contam).
	const config = await getRuntimeConfig();
	const referrer = cleanReferrer(d.referrer, ownHostsOf(config.allowedOrigins, config.checkoutDomains));

	await upsertVisitor({
		email: d.email,
		fbc: d.fbc,
		fbp: d.fbp,
		firstName: d.first_name,
		gaClientId: d.ga_client_id,
		gaSessionId: d.ga_session_id,
		geo: lookupGeo(ip),
		ip,
		landingUrl: d.landing_url,
		lastName: d.last_name,
		phone: d.phone,
		pixelId: d.pixel_id,
		referrer,
		trckUserId,
		userAgent,
		utmCampaign: d.utm_campaign,
		utmContent: d.utm_content,
		utmMedium: d.utm_medium,
		utmSource: d.utm_source,
		utmTerm: d.utm_term,
	});

	return json({ ok: true, trck_user_id: trckUserId }, 200, cors);
}
