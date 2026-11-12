import "server-only";
import { botNetwork } from "@/lib/geo";
import { type BotReason, botUserAgentReason } from "./bot-user-agent";

/*
 * Decide se uma requisição de captura (identify, event, video) vem de robô. Robô recebe OK e nada é
 * gravado nem enviado. Ordem: rede do IP (Meta/Google e nuvem) → navegador (user agent).
 * O aviso de automação do t.js (`wd`) só existe depois de ler o corpo: cada rota confere em seguida.
 *
 * Contagem em memória (aba Saúde): uma por carregamento de página, no identify. Volta a zero quando
 * o app reinicia; serve para ver o filtro funcionando, não como histórico.
 */

export function botReason(ip: string | null, userAgent: string | null): BotReason | null {
	const network = botNetwork(ip);
	if (network) return network.kind;
	return botUserAgentReason(userAgent);
}

const g = globalThis as unknown as {
	__botIgnored?: { since: string; counts: Partial<Record<BotReason, number>> };
};

function store() {
	g.__botIgnored ??= { counts: {}, since: new Date().toISOString() };
	return g.__botIgnored;
}

export function countIgnoredVisit(reason: BotReason) {
	const s = store();
	s.counts[reason] = (s.counts[reason] ?? 0) + 1;
}

export function ignoredVisits(): { since: string; counts: Partial<Record<BotReason, number>> } {
	const s = store();
	return { counts: { ...s.counts }, since: s.since };
}
