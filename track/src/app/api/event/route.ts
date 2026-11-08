import { after } from "next/server";
import { botNetwork, lookupGeo } from "@/lib/geo";
import { readJsonBody } from "@/lib/http/body";
import { clientIp, rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { deliverEventToMeta, insertEvent } from "@/lib/tracking/events";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { eventSchema } from "@/lib/tracking/schemas";
import { upsertVisitor } from "@/lib/tracking/visitors";

/*
 * POST /api/event — registra o evento e envia para a Meta CAPI (todos os pixels ativos)
 * com o MESMO event_id do Pixel do navegador (deduplicação).
 * GA4: os eventos web vão pela gtag no navegador; aqui NÃO usamos o Measurement Protocol.
 * O envio à Meta roda depois da resposta (after), para o site não esperar.
 */

const limiter = createRateLimiter({ burst: 40, perMinute: 120 });
const MAX_BYTES = 16 * 1024;

export function OPTIONS(request: Request) {
	return preflight(request);
}

export async function POST(request: Request) {
	const origin = await allowedOrigin(request);
	if (!origin) return json({ error: "origem não autorizada" }, 403);
	const cors = corsHeaders(origin);

	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, cors);

	// Robô da Meta/Google executando a página (revisão de anúncio, prévia de link): não é cliente.
	// Responde OK para o t.js e não grava nem envia nada.
	if (botNetwork(clientIp(request.headers))) return json({ ignored: true, ok: true }, 200, cors);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json(
			{ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" },
			body.status,
			cors,
		);

	const parsed = eventSchema.safeParse(body.data);
	if (!parsed.success)
		return json(
			{ error: "dados inválidos", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
			cors,
		);
	const d = parsed.data;

	const config = await getRuntimeConfig();
	const ip = clientIp(request.headers);
	const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
	const geo = lookupGeo(ip);

	// Garante o visitante (caso o identify ainda não tenha chegado) e pega os dados para enriquecer.
	const visitor = await upsertVisitor({
		email: d.user_data?.email,
		fbc: d.fbc,
		fbp: d.fbp,
		firstName: d.user_data?.first_name,
		gaClientId: d.ga_client_id,
		gaSessionId: d.ga_session_id,
		geo,
		ip,
		lastName: d.user_data?.last_name,
		phone: d.user_data?.phone,
		trckUserId: d.trck_user_id,
		userAgent,
		// Sem UTM no evento, o visitante mantém as que já tinha (o upsert só troca o conjunto inteiro).
		utmCampaign: d.utm_campaign,
		utmContent: d.utm_content,
		utmMedium: d.utm_medium,
		utmSource: d.utm_source,
		utmTerm: d.utm_term,
	});

	const customData = d.custom_data
		? {
				...d.custom_data,
				...(d.custom_data.value !== undefined
					? { currency: (d.custom_data.currency ?? config.currency).toUpperCase() }
					: {}),
			}
		: undefined;

	const input = {
		customData,
		eventId: d.event_id,
		eventName: d.event_name,
		eventSourceUrl: d.event_source_url,
		geo,
		ip,
		userAgent,
		visitor,
	};
	const rowId = await insertEvent(input);
	if (rowId === null) return json({ duplicate: true, ok: true }, 200, cors);

	after(() => deliverEventToMeta(rowId, input, config));
	return json({ ok: true }, 202, cors);
}
