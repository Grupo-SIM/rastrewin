import "server-only";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";

/*
 * CORS dos endpoints de captura: só as origens cadastradas em Configurações › Geral.
 * Sem cookies (credentials) — o trck_user_id vai no corpo.
 */

export function corsHeaders(origin: string, methods = "POST, OPTIONS"): Record<string, string> {
	return {
		"Access-Control-Allow-Headers": "content-type",
		"Access-Control-Allow-Methods": methods,
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

/** Retorna a origem se ela estiver autorizada; null caso contrário. */
export async function allowedOrigin(request: Request): Promise<string | null> {
	const origin = request.headers.get("origin");
	if (!origin) return null;
	const { allowedOrigins } = await getRuntimeConfig();
	return allowedOrigins.includes(origin) ? origin : null;
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}) {
	return Response.json(body, { headers: { "Cache-Control": "no-store", ...headers }, status });
}

/** Resposta do preflight (OPTIONS). */
export async function preflight(request: Request, methods?: string) {
	const origin = await allowedOrigin(request);
	if (!origin) return new Response(null, { status: 403 });
	return new Response(null, { headers: corsHeaders(origin, methods), status: 204 });
}
