import { isIP } from "node:net";
import type { Request } from "express";

/*
 * IP de quem chamou, para os limites de requisição. Mesma ideia do track (track/src/lib/http/client-ip.ts):
 * vale o ÚLTIMO IP do X-Forwarded-For, que o NOSSO proxy (Caddy, label caddy.reverse_proxy em
 * compose.production.yaml) põe com o IP da conexão; os anteriores vêm do cliente e são forjáveis.
 * X-Real-IP e cf-connecting-ip são ignorados: o Caddy do backend não os sobrescreve, então qualquer um
 * poderia inventar um valor novo a cada pedido e escapar do limite.
 * Seguro porque a porta 3011 não é publicada: só se chega ao backend pelo proxy (ou pela rede interna).
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

/** Chave do limite. Sem IP confiável, todos dividem um balde ("unknown"): restritivo, nunca permissivo. */
export function rateLimitKey(req: Request): string {
	const xff = req.headers["x-forwarded-for"];
	const last = (Array.isArray(xff) ? xff.join(",") : (xff ?? "")).split(",").at(-1);
	return clean(last) ?? clean(req.socket?.remoteAddress) ?? "unknown";
}
