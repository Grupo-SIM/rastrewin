/*
 * Origem sem UTM: de qual site a pessoa veio (document.referrer). Funções PURAS (testadas).
 * - Captura: cleanReferrer descarta o próprio site (sites autorizados e domínios do checkout) e
 *   guarda só origem + caminho, sem query nem # (a query pode carregar dado pessoal).
 * - Exibição: referrerSource dá um rótulo amigável (Google, Instagram...); originOf é a regra única
 *   da coluna "Origem" (UTM vence; sem UTM, o referrer; sem nada, Direto).
 * O visitante guarda a PRIMEIRA origem externa conhecida (visitors.referrer, keepFirst).
 */

export const DIRECT_LABEL = "Direto / sem referência";

/** "https://www.rastrewin.com" | "vsl.rastrewin.com" → "rastrewin.com" | "vsl.rastrewin.com" (sem www). */
export function hostOf(value: string | null | undefined): string | null {
	if (!value) return null;
	const raw = value.trim();
	if (!raw) return null;
	try {
		const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
		return host.replace(/^www\./, "") || null;
	} catch {
		return null;
	}
}

/** Lista de sites próprios (origens autorizadas e domínios do checkout) → hosts sem www. */
export function ownHostsOf(...lists: (string[] | null | undefined)[]): string[] {
	const out = new Set<string>();
	for (const list of lists)
		for (const v of list ?? []) {
			const h = hostOf(v);
			if (h) out.add(h);
		}
	return [...out];
}

/** Próprio site: um dos hosts ou subdomínio dele (app.rastrewin.com conta como rastrewin.com). */
function isOwn(host: string, ownHosts: string[]): boolean {
	return ownHosts.some(own => host === own || host.endsWith(`.${own}`));
}

/** Referrer para guardar: null se vazio, inválido ou do próprio site; senão origem + caminho. */
export function cleanReferrer(url: string | null | undefined, ownHosts: string[]): string | null {
	if (!url) return null;
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") return null;
	const host = u.hostname.toLowerCase().replace(/^www\./, "");
	if (!host || isOwn(host, ownHosts)) return null;
	return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
}

export type ReferrerKey =
	| "direto"
	| "google"
	| "facebook"
	| "instagram"
	| "youtube"
	| "x"
	| "tiktok"
	| "bing"
	| "duckduckgo"
	| "yahoo"
	| "linkedin"
	| "whatsapp"
	| "pinterest"
	| "reddit"
	| "chatgpt"
	| "perplexity"
	| "site";

export interface ReferrerSource {
	key: ReferrerKey;
	label: string;
	/** Domínio de onde veio (sem www); null quando direto. */
	host: string | null;
}

/** Fontes conhecidas: o host é igual a um destes ou termina em ".<este>". */
const KNOWN: {
	key: Exclude<ReferrerKey, "direto" | "site" | "google" | "yahoo">;
	label: string;
	hosts: string[];
}[] = [
	{ hosts: ["facebook.com", "fb.com", "fb.me"], key: "facebook", label: "Facebook" },
	{ hosts: ["instagram.com"], key: "instagram", label: "Instagram" },
	{ hosts: ["youtube.com", "youtu.be"], key: "youtube", label: "YouTube" },
	{ hosts: ["t.co", "x.com", "twitter.com"], key: "x", label: "X (Twitter)" },
	{ hosts: ["tiktok.com"], key: "tiktok", label: "TikTok" },
	{ hosts: ["bing.com"], key: "bing", label: "Bing" },
	{ hosts: ["duckduckgo.com"], key: "duckduckgo", label: "DuckDuckGo" },
	{ hosts: ["linkedin.com", "lnkd.in"], key: "linkedin", label: "LinkedIn" },
	{ hosts: ["whatsapp.com", "wa.me"], key: "whatsapp", label: "WhatsApp" },
	{ hosts: ["pinterest.com", "pin.it"], key: "pinterest", label: "Pinterest" },
	{ hosts: ["reddit.com"], key: "reddit", label: "Reddit" },
	{ hosts: ["chatgpt.com", "chat.openai.com"], key: "chatgpt", label: "ChatGPT" },
	{ hosts: ["perplexity.ai"], key: "perplexity", label: "Perplexity" },
];

const matches = (host: string, base: string) => host === base || host.endsWith(`.${base}`);

/** Referrer guardado → rótulo amigável. Vazio, inválido ou do próprio site = Direto. */
export function referrerSource(url: string | null | undefined, ownHosts: string[]): ReferrerSource {
	const host = hostOf(url);
	if (!host || isOwn(host, ownHosts)) return { host: null, key: "direto", label: DIRECT_LABEL };
	// google.com, google.com.br, www.google.co.uk, news.google.com...
	if (/(^|\.)google\.[a-z.]+$/.test(host)) return { host, key: "google", label: "Google" };
	if (/(^|\.)yahoo\.[a-z.]+$/.test(host)) return { host, key: "yahoo", label: "Yahoo" };
	for (const k of KNOWN)
		if (k.hosts.some(b => matches(host, b))) return { host, key: k.key, label: k.label };
	return { host, key: "site", label: host };
}

export interface OriginInput {
	utmSource: string | null;
	utmCampaign: string | null;
	referrer: string | null;
}
export interface Origin {
	/** UTM (fonte · campanha), referrer (site de onde veio) ou direto. */
	kind: "utm" | "referrer" | "direto";
	label: string;
	/** Detalhe para o title (domínio do referrer). */
	detail: string | null;
}

/** Regra única da coluna "Origem": UTM vence; sem UTM, o site de onde veio; sem nada, Direto. */
export function originOf(r: OriginInput, ownHosts: string[]): Origin {
	const utm = [r.utmSource, r.utmCampaign].filter(Boolean).join(" · ");
	if (utm) return { detail: null, kind: "utm", label: utm };
	const src = referrerSource(r.referrer, ownHosts);
	if (src.key === "direto") return { detail: null, kind: "direto", label: DIRECT_LABEL };
	return { detail: src.host, kind: "referrer", label: src.label };
}

export interface OriginCountRow {
	/** utm_source mais recente do visitante no período (null = sem UTM). */
	utmSource: string | null;
	/** Domínio do referrer guardado (já extraído no SQL) ou o endereço. */
	referrer: string | null;
	visitors: number;
}

/**
 * Resumo "Origens dos visitantes": UTM vira "UTM · fonte"; sem UTM, o rótulo do referrer.
 * Ordenado do maior para o menor; além de `top` grupos, o resto vira "Outros".
 */
export function summarizeOrigins(
	rows: OriginCountRow[],
	ownHosts: string[],
	top = 8,
): { label: string; value: number }[] {
	const by = new Map<string, number>();
	for (const r of rows) {
		const utm = r.utmSource?.trim();
		const label = utm ? `UTM · ${utm.toLowerCase()}` : referrerSource(r.referrer, ownHosts).label;
		by.set(label, (by.get(label) ?? 0) + r.visitors);
	}
	const sorted = [...by.entries()]
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
	if (sorted.length <= top) return sorted;
	const rest = sorted.slice(top - 1).reduce((s, x) => s + x.value, 0);
	return [...sorted.slice(0, top - 1), { label: "Outros", value: rest }];
}
