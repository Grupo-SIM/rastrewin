/*
 * Rastreamento (track.rastrewin.com). O script t.js é carregado pelo layout: em produção, de
 * https://track.rastrewin.com; no dev, só se NEXT_PUBLIC_TRACK_URL apontar para um track local.
 * - trck(...): fila do t.js (funciona antes de ele carregar; sem script, não faz nada).
 * - readTracking(): origem do visitante enviada no cadastro (POST /users). O backend guarda e
 *   repassa ao track junto com a venda, que assim liga a compra à visita/anúncio.
 */

export const TRACK_URL =
	process.env.NEXT_PUBLIC_TRACK_URL ||
	(process.env.NODE_ENV === "production" ? "https://track.rastrewin.com" : "");

/** Mesmo stub do cartão "Instalação no site" do painel do track. */
export const TRCK_STUB = "window.trck=window.trck||function(){(trck.q=trck.q||[]).push(arguments)};";

type Trck = ((...args: unknown[]) => void) & { id?: string };

declare global {
	interface Window {
		trck?: Trck;
	}
}

export function trck(...args: unknown[]) {
	if (typeof window !== "undefined") window.trck?.(...args);
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

function cookie(name: string): string | null {
	const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	if (!m) return null;
	try {
		return decodeURIComponent(m[1]);
	} catch {
		return null;
	}
}

/**
 * Escolha feita no banner de cookies (cookie necessário _trck_consent, gravado pelo t.js no domínio
 * raiz): "granted" = aceitou marketing, "rejected" = recusou. null = ainda não escolheu (ou script bloqueado).
 */
function readConsent(): "granted" | "rejected" | null {
	try {
		const c = JSON.parse(cookie("_trck_consent") ?? "null") as { m?: unknown } | null;
		if (typeof c?.m === "boolean") return c.m ? "granted" : "rejected";
	} catch {
		/* cookie ausente ou inválido */
	}
	return null;
}

/**
 * src (= trck_user_id), UTMs guardadas pelo t.js, cookies da Meta e a escolha do banner. Só o que existir.
 * LGPD: quem recusou o banner manda SÓ a recusa. O backend troca por ela o que um cadastro anterior
 * tinha gravado, e o track não liga a venda a nenhum aceite antigo (e-mail, telefone ou outro aparelho).
 */
export function readTracking(): Record<string, string> {
	const consent = readConsent();
	if (consent === "rejected") return { consent };
	const out: Record<string, string> = consent ? { consent } : {};
	const id = window.trck?.id ?? cookie("_trck");
	if (id) out.src = id;
	try {
		const saved = JSON.parse(localStorage.getItem("_trck_utm") ?? "null") as Record<
			string,
			unknown
		> | null;
		for (const k of UTM_KEYS) if (typeof saved?.[k] === "string" && saved[k]) out[k] = saved[k] as string;
	} catch {
		/* sem UTM guardada ou modo privado */
	}
	const fbc = cookie("_fbc");
	const fbp = cookie("_fbp");
	if (fbc) out.fbc = fbc;
	if (fbp) out.fbp = fbp;
	return out;
}

/**
 * Link do checkout com a origem do visitante na query (src, UTMs, fbc, fbp): o SimIntPay aceita
 * esses campos e devolve no webhook, então a venda se liga à visita mesmo que o comprador use
 * outro email no checkout. Não sobrescreve o que o link já trouxer.
 */
export function withTracking(checkoutUrl: string): string {
	try {
		const url = new URL(checkoutUrl);
		for (const [k, v] of Object.entries(readTracking())) {
			// A escolha do banner vai só no cadastro (backend); o checkout só conhece src, UTMs, fbc e fbp.
			if (k !== "consent" && !url.searchParams.has(k)) url.searchParams.set(k, v);
		}
		return url.toString();
	} catch {
		return checkoutUrl;
	}
}
