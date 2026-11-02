import "server-only";
import { GA4_MP_DEBUG_URL } from "@/lib/ga4/endpoints";
import { describeGraphError, graphGet } from "@/lib/meta/graph";

export type TestStatus = "ok" | "warning" | "error";
export type TestResult = { status: TestStatus; message: string };

/**
 * Pixel / Conversions API: consulta o pixel com o token.
 * Não envia evento de teste: pela doc da Meta, eventos com test_event_code NÃO são descartados.
 */
export async function testMetaPixel(pixelId: string, token: string): Promise<TestResult> {
  const result = await graphGet<{ id: string; name?: string }>(pixelId, token, { fields: "id,name" });
  if (!result.ok) return { status: "error", message: describeGraphError(result.error) };
  return {
    status: "ok",
    message: `Pixel encontrado: ${result.data.name ?? result.data.id}. O token tem acesso.`,
  };
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
  if (!result.ok) return { status: "error", message: describeGraphError(result.error) };
  const { name, account_status: code, currency } = result.data;
  const label = code !== undefined ? (AD_ACCOUNT_STATUS[code] ?? `status ${code}`) : "status desconhecido";
  return {
    status: code === 1 ? "ok" : "warning",
    message: `Conta "${name ?? adAccountId}" (${currency ?? "?"}) — ${label}.`,
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
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "1234567890.1234567890",
        validation_behavior: "ENFORCE_RECOMMENDATIONS",
        events: [{ name: "connection_test", params: { engagement_time_msec: 1 } }],
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      validationMessages?: { fieldPath?: string; description?: string }[];
    };
    if (!response.ok) return { status: "error", message: `O GA4 respondeu HTTP ${response.status}.` };
    const messages = body.validationMessages ?? [];
    if (messages.length) {
      return { status: "error", message: messages.map((m) => m.description).join(" ") };
    }
    return {
      status: "warning",
      message:
        "Formato aceito pelo GA4. O Google não confirma o api_secret neste teste: confira no DebugView quando a primeira venda for enviada.",
    };
  } catch {
    return { status: "error", message: "Falha de rede ao falar com o GA4." };
  }
}
