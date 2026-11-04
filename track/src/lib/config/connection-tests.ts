import "server-only";
import { GA4_MP_DEBUG_URL } from "@/lib/ga4/endpoints";
import { describeGraphError, graphGet, graphPost } from "@/lib/meta/graph";

export type TestStatus = "ok" | "warning" | "error";
export interface TestResult {
	status: TestStatus;
	message: string;
}

/**
 * Pixel / Conversions API — teste SEM criar evento:
 * POST /{pixel_id}/events com `data: []`. A Meta confere token e permissão no pixel ANTES do corpo:
 *   - "param data must be non-empty" → token válido e com permissão de envio ✅
 *   - código 190 → token inválido/expirado; subcode 33 → sem acesso a este pixel (ou ID errado)
 * Não usamos GET /{pixel_id}: o token da Conversions API (Gerenciador de Eventos) costuma
 * NÃO ter permissão de leitura do pixel ("(#100) Missing Permission"), mesmo enviando eventos.
 * Também não enviamos evento de teste: pela doc, eventos com test_event_code não são descartados.
 */
export async function testMetaPixel(pixelId: string, token: string): Promise<TestResult> {
	const result = await graphPost<unknown>(`${pixelId}/events`, token, { data: [] });
	if (result.ok) return { message: "Token aceito pela Conversions API para este pixel.", status: "ok" };
	const { error } = result;
	if (error.code === 100 && error.error_subcode !== 33 && /data must be non-empty/i.test(error.message)) {
		return {
			message: "Token aceito pela Conversions API: tem permissão para enviar eventos a este pixel.",
			status: "ok",
		};
	}
	if (error.code === 100 && error.error_subcode === 33) {
		return {
			message: "Este token não tem acesso a este pixel (ou o ID do pixel está errado).",
			status: "error",
		};
	}
	return { message: describeGraphError(error), status: "error" };
}

const AD_ACCOUNT_STATUS: Record<number, string> = {
	1: "ativa",
	2: "desativada",
	3: "com pagamento pendente",
	7: "em análise de risco",
	8: "com acerto pendente",
	9: "em período de carência",
	100: "com encerramento pendente",
	101: "encerrada",
};

/** Conta de anúncios: lê nome, status e moeda. */
export async function testMetaAdAccount(adAccountId: string, token: string): Promise<TestResult> {
	const result = await graphGet<{ name?: string; account_status?: number; currency?: string }>(
		`act_${adAccountId}`,
		token,
		{ fields: "name,account_status,currency" },
	);
	if (!result.ok) return { message: describeGraphError(result.error), status: "error" };
	const { name, account_status: code, currency } = result.data;
	const label = code !== undefined ? (AD_ACCOUNT_STATUS[code] ?? `status ${code}`) : "status desconhecido";
	return {
		message: `Conta "${name ?? adAccountId}" (${currency ?? "?"}) — ${label}.`,
		status: code === 1 ? "ok" : "warning",
	};
}

/**
 * GA4: manda um evento ao servidor de VALIDAÇÃO (não entra nos relatórios).
 * O servidor não valida o api_secret, então o resultado bom é "warning": confirme no DebugView.
 */
export async function testGa4(measurementId: string, apiSecret: string): Promise<TestResult> {
	const url = new URL(GA4_MP_DEBUG_URL);
	url.searchParams.set("measurement_id", measurementId);
	url.searchParams.set("api_secret", apiSecret);
	try {
		const response = await fetch(url, {
			body: JSON.stringify({
				client_id: "1234567890.1234567890",
				events: [{ name: "connection_test", params: { engagement_time_msec: 1 } }],
				validation_behavior: "ENFORCE_RECOMMENDATIONS",
			}),
			cache: "no-store",
			headers: { "content-type": "application/json" },
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(10_000),
		});
		const body = (await response.json().catch(() => ({}))) as {
			validationMessages?: { fieldPath?: string; description?: string }[];
		};
		if (!response.ok) return { message: `O GA4 respondeu HTTP ${response.status}.`, status: "error" };
		const messages = body.validationMessages ?? [];
		if (messages.length) {
			return { message: messages.map(m => m.description).join(" "), status: "error" };
		}
		return {
			message:
				"Formato aceito pelo GA4. O Google não confirma o api_secret neste teste: confira no DebugView quando a primeira venda for enviada.",
			status: "warning",
		};
	} catch {
		return { message: "Falha de rede ao falar com o GA4.", status: "error" };
	}
}
