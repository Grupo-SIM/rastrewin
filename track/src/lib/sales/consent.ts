/*
 * Recusa explícita do banner de cookies na visita da compra (LGPD).
 * O site manda tracking.consent = "rejected" no cadastro, o backend repassa com a venda, e a compra é
 * gravada com match.consent = "rejected" (ver process.ts). Sem resposta ao banner não há essa marca.
 * Módulo sem dependências de servidor: usado também pelo painel (rótulo "Banner recusado").
 */

/** Motivo gravado no match da venda com recusa. */
export const BANNER_REJECTED_REASON = "recusou o banner de cookies na visita da compra";

/**
 * A venda tem a recusa explícita do banner? Lê a marca `consent: "rejected"` do match. O motivo
 * sozinho cobre as vendas gravadas antes da marca existir (versão de 14/11/2026).
 */
export function isBannerRejected(match: unknown): boolean {
	if (!match || typeof match !== "object") return false;
	const m = match as { consent?: unknown; reason?: unknown };
	return m.consent === "rejected" || m.reason === BANNER_REJECTED_REASON;
}
