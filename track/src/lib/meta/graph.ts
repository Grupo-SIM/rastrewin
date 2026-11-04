import "server-only";
import { META_GRAPH_BASE_URL } from "./version";

/*
 * Cliente mínimo da Graph API (Meta). O token vai no parâmetro `access_token`,
 * como a documentação indica, e nunca é logado nem devolvido em mensagens de erro.
 */

export interface GraphError {
	message: string;
	type?: string;
	code?: number;
	error_subcode?: number;
	fbtrace_id?: string;
}

/** Headers de uso/limite que a Meta devolve (para o rate limit conservador). */
export interface GraphUsage {
	app?: unknown;
	businessUseCase?: unknown;
	adAccount?: unknown;
	/** x-fb-ads-insights-throttle (específico da Insights API) */
	insights?: unknown;
}

export type GraphResult<T> =
	| { ok: true; status: number; data: T; usage: GraphUsage }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage };

const TIMEOUT_MS = 10_000;

function parseJsonHeader(value: string | null): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function readUsage(headers: Headers): GraphUsage {
	return {
		adAccount: parseJsonHeader(headers.get("x-ad-account-usage")),
		app: parseJsonHeader(headers.get("x-app-usage")),
		businessUseCase: parseJsonHeader(headers.get("x-business-use-case-usage")),
		insights: parseJsonHeader(headers.get("x-fb-ads-insights-throttle")),
	};
}

async function request<T>(url: URL, init: RequestInit): Promise<GraphResult<T>> {
	try {
		const response = await fetch(url, {
			...init,
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const usage = readUsage(response.headers);
		const body = (await response.json().catch(() => ({}))) as { error?: GraphError } & T;
		if (!response.ok || body.error) {
			return {
				error: body.error ?? { message: `HTTP ${response.status}` },
				ok: false,
				status: response.status,
				usage,
			};
		}
		return { data: body, ok: true, status: response.status, usage };
	} catch (error) {
		const message =
			error instanceof Error && error.name === "TimeoutError"
				? "Tempo esgotado ao falar com a Meta"
				: "Falha de rede ao falar com a Meta";
		return { error: { message }, ok: false, status: 0, usage: {} };
	}
}

/** GET /{path}?fields=...  (path sem barra inicial, ex.: "123456" ou "act_123/insights") */
export function graphGet<T>(path: string, token: string, params: Record<string, string> = {}) {
	const url = new URL(`${META_GRAPH_BASE_URL}/${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	url.searchParams.set("access_token", token);
	return request<T>(url, { method: "GET" });
}

/** GET de uma URL de paginação (`paging.next`) devolvida pela própria Meta. */
export function graphGetUrl<T>(next: string) {
	const url = new URL(next);
	if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") {
		return Promise.resolve({
			error: { message: "URL de paginação inválida" },
			ok: false,
			status: 0,
			usage: {},
		} as GraphResult<T>);
	}
	return request<T>(url, { method: "GET" });
}

/** POST /{path} com corpo JSON (ex.: "{pixel_id}/events"). */
export function graphPost<T>(path: string, token: string, body: Record<string, unknown>) {
	const url = new URL(`${META_GRAPH_BASE_URL}/${path}`);
	url.searchParams.set("access_token", token);
	return request<T>(url, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
}

/** Mensagem amigável (pt-BR) para os erros mais comuns da Graph API. */
export function describeGraphError(error: GraphError): string {
	switch (error.code) {
		case 190:
			return "Token inválido ou expirado. Gere um novo token e salve de novo.";
		case 10:
		case 200:
		case 294:
			return "O token não tem permissão para este recurso.";
		case 100:
			return error.error_subcode === 33
				? "ID não encontrado ou sem acesso com este token."
				: `Parâmetro inválido: ${error.message}`;
		case 4:
		case 17:
		case 32:
		case 613:
		case 80000:
		case 80004:
			return "Limite de requisições da Meta atingido. Tente de novo mais tarde.";
		default:
			return error.message;
	}
}
