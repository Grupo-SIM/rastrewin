/*
 * Jornada do visitante: funções PURAS (testadas) usadas pela consulta e pela tela.
 */

export interface Utm {
	source: string | null;
	medium: string | null;
	campaign: string | null;
	term: string | null;
	content: string | null;
}

/** "Campanha A|120200000000001" → { name: "Campanha A", id: "120200000000001" }. Sem "|id", só o nome. */
export function splitUtm(value: string | null | undefined): { name: string | null; id: string | null } {
	if (!value) return { id: null, name: null };
	const i = value.lastIndexOf("|");
	const tail = i >= 0 ? value.slice(i + 1).trim() : "";
	if (i >= 0 && /^\d{6,25}$/.test(tail)) return { id: tail, name: value.slice(0, i).trim() || null };
	return { id: null, name: value.trim() || null };
}

/** Alguma UTM preenchida? */
export function hasUtm(u: Utm): boolean {
	return !!(u.source || u.medium || u.campaign || u.term || u.content);
}

/** Mesma origem? (compara as 5 UTMs) */
export function sameUtm(a: Utm, b: Utm): boolean {
	return (
		a.source === b.source &&
		a.medium === b.medium &&
		a.campaign === b.campaign &&
		a.term === b.term &&
		a.content === b.content
	);
}

/** Resumo curto da origem: "facebook · paid · Campanha A". */
export function utmSummary(u: Utm): string {
	return [u.source, u.medium, splitUtm(u.campaign).name].filter(Boolean).join(" · ");
}

/**
 * Cookie _fbc ("fb.1.<ms>.<fbclid>") → quando houve o clique no anúncio da Meta e o fbclid.
 * null se não for um _fbc válido.
 */
export function fbcInfo(fbc: string | null | undefined): { clickedAt: string; fbclid: string } | null {
	const m = /^fb\.\d+\.(\d{10,13})\.(.+)$/.exec(fbc ?? "");
	if (!m) return null;
	const ms = m[1].length === 10 ? Number(m[1]) * 1000 : Number(m[1]);
	if (!Number.isFinite(ms)) return null;
	return { clickedAt: new Date(ms).toISOString(), fbclid: m[2] };
}

/** Eventos de venda do SimIntPay → texto da linha do tempo. */
const SALE_EVENT_LABEL: Record<string, string> = {
	card_declined: "Cartão recusado",
	chargeback: "Chargeback",
	pix_expired: "PIX expirado",
	pix_generated: "PIX gerado",
	purchase_approved: "Compra aprovada",
	purchase_refunded: "Compra reembolsada",
	refund_requested: "Pedido de reembolso",
};
export function saleEventLabel(type: string): string {
	return SALE_EVENT_LABEL[type] ?? type;
}

/**
 * Junta itens de várias fontes (cada uma já em ordem decrescente) e devolve os `limit` mais
 * recentes em ordem CRONOLÓGICA (do mais antigo ao mais novo).
 */
export function latestChronological<T extends { at: string }>(sources: T[][], limit: number): T[] {
	return sources
		.flat()
		.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
		.slice(0, limit)
		.reverse();
}

const timeFmt = new Map<string, Intl.DateTimeFormat>();
const dayFmt = new Map<string, Intl.DateTimeFormat>();

/** "14:03:27" no fuso do painel. */
export function formatTimeSec(iso: string, timeZone: string): string {
	let f = timeFmt.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat("pt-BR", {
			hour: "2-digit",
			hourCycle: "h23",
			minute: "2-digit",
			second: "2-digit",
			timeZone,
		});
		timeFmt.set(timeZone, f);
	}
	return f.format(new Date(iso));
}

/** "sábado, 07/11/2026" no fuso do painel (cabeçalho de cada dia). */
export function formatDayLong(iso: string, timeZone: string): string {
	let f = dayFmt.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			timeZone,
			weekday: "long",
			year: "numeric",
		});
		dayFmt.set(timeZone, f);
	}
	return f.format(new Date(iso));
}

/** Navegador e sistema, em poucas palavras, a partir do user agent. */
export function deviceSummary(ua: string | null | undefined): string | null {
	if (!ua) return null;
	const os = /iPhone|iPad/.test(ua)
		? "iOS"
		: /Android/.test(ua)
			? "Android"
			: /Windows/.test(ua)
				? "Windows"
				: /Mac OS X|Macintosh/.test(ua)
					? "macOS"
					: /Linux/.test(ua)
						? "Linux"
						: null;
	const browser = /FBAN|FBAV|FB_IAB/.test(ua)
		? "Facebook (app)"
		: /Instagram/.test(ua)
			? "Instagram (app)"
			: /Edg\//.test(ua)
				? "Edge"
				: /SamsungBrowser/.test(ua)
					? "Samsung Internet"
					: /CriOS|Chrome\//.test(ua)
						? "Chrome"
						: /FxiOS|Firefox\//.test(ua)
							? "Firefox"
							: /Safari\//.test(ua)
								? "Safari"
								: null;
	const mobile = /Mobile|iPhone|Android/.test(ua) ? "celular" : "computador";
	return [browser, os, mobile].filter(Boolean).join(" · ") || null;
}
