import { describeGraphError, type GraphError } from "./graph";

/*
 * Motivo legível de um envio recusado pela Conversions API (resposta de um pixel, como fica gravada
 * em response_meta). Usado no "Último erro" da venda e no aviso do painel quando a Meta recusa.
 */

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function capiFailureReason(response: { status?: number; body?: unknown } | null | undefined): string {
	const error = (response?.body as { error?: unknown } | null | undefined)?.error;
	if (error && typeof error === "object" && typeof (error as GraphError).message === "string") {
		const e = error as GraphError;
		// O mesmo caso do "Testar conexão": token sem acesso ao pixel (a pane de 28/11).
		if (e.code === 100 && e.error_subcode === 33)
			return "este token não tem acesso a este pixel (ou o ID do pixel está errado)";
		return lowerFirst(describeGraphError(e)).replace(/\.$/, "");
	}
	if (typeof error === "string") return error;
	return response?.status
		? `a Meta respondeu HTTP ${response.status}`
		: "falha de rede ao falar com a Meta";
}
