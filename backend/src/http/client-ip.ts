import { isIP } from "node:net";
import type { Request } from "express";

/*
 * IP de quem chamou, para os limites de requisição. Mesma ideia do track (track/src/lib/http/client-ip.ts):
 * vale o ÚLTIMO IP do X-Forwarded-For, que o NOSSO proxy (Caddy, label caddy.reverse_proxy em
 * compose.production.yaml) põe com o IP da conexão; os anteriores vêm do cliente e são forjáveis.
 * X-Real-IP e cf-connecting-ip são ignorados: o Caddy do backend não os sobrescreve, então qualquer um
 * poderia inventar um valor novo a cada pedido e escapar do limite.
 * Seguro porque a porta 3011 não é publicada: só se chega ao backend pelo proxy (ou pela rede interna).
 *
 * Duas premissas que valem HOJE (confirmadas no DNS em 2026-11-19) e que precisam ser revistas se mudarem:
 *  1. api.rastrewin.com aponta direto para a VPS. Se o proxy da Cloudflare for ligado, o "último IP" passa a ser
 *     o da Cloudflare e todo mundo cai no mesmo balde: configure `trusted_proxies cloudflare` no Caddy e leia o
 *     IP do cliente do cabeçalho que ele repassar, antes de ligar.
 *  2. O backend também está na rede externa `proxy` do compose (o Caddy precisa dela). Outro container nessa
 *     rede chega em backend:3011 sem passar pelo Caddy e pode inventar o X-Forwarded-For. Só ponha na rede
 *     `proxy` containers de confiança.
 */

function clean(value: string | undefined): string | null {
	if (!value) return null;
	let ip = value.trim();
	if (ip.startsWith("[") && ip.includes("]"))
		ip = ip.slice(1, ip.indexOf("]")); // [ipv6]:porta
	else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0]; // ipv4:porta
	if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
	return isIP(ip) ? ip : null;
}

/** IPv6: cada cliente recebe um /64 inteiro, então o limite vale para o /64 (senão bastaria trocar o final do endereço). */
function ipv6Prefix(ip: string): string {
	const [head = "", tail = ""] = ip.split("%")[0].split("::");
	const h = head ? head.split(":") : [];
	const t = tail ? tail.split(":") : [];
	const groups = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
	return `${groups
		.slice(0, 4)
		.map(g => Number.parseInt(g || "0", 16).toString(16))
		.join(":")}::/64`;
}

/** Chave do limite. Sem IP confiável, todos dividem um balde ("unknown"): restritivo, nunca permissivo. */
export function rateLimitKey(req: Request): string {
	const xff = req.headers["x-forwarded-for"];
	const last = (Array.isArray(xff) ? xff.join(",") : (xff ?? "")).split(",").at(-1);
	const ip = clean(last) ?? clean(req.socket?.remoteAddress);
	if (!ip) return "unknown";
	return isIP(ip) === 6 ? ipv6Prefix(ip) : ip;
}
