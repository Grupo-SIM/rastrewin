import { isIP } from "node:net";

/*
 * IP do visitante — UMA regra para geo, Meta, rate limit e login:
 *   1. X-Real-IP, que o NOSSO proxy reverso (nginx/Caddy na mesma VPS) SOBRESCREVE com o IP da conexão;
 *   2. senão, o ÚLTIMO IP do X-Forwarded-For (o que o proxy anexou; os anteriores vêm do cliente e são forjáveis).
 * Cabeçalhos que o cliente pode inventar (cf-connecting-ip, true-client-ip, 1º IP do XFF) são ignorados.
 * Isso só é seguro porque o app NÃO é acessível sem passar pelo proxy (porta 3000 presa em 127.0.0.1).
 * Configuração do proxy: deploy/nginx.conf e deploy/Caddyfile.
 */

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]")); // [ipv6]:porta
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0]; // ipv4:porta
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

function trustedIp(headers: Headers): string | null {
  const real = clean(headers.get("x-real-ip"));
  if (real) return real;
  const parts = (headers.get("x-forwarded-for") ?? "").split(",");
  return clean(parts.at(-1));
}

/** IP do visitante (vai para a Meta e para a geo). */
export function clientIp(headers: Headers): string | null {
  return trustedIp(headers);
}

/** Chave do rate limit. Sem IP confiável, todos dividem um balde ("unknown"), o que é restritivo e nunca permissivo. */
export function rateLimitKey(headers: Headers): string {
  return trustedIp(headers) ?? "unknown";
}

/** De onde veio o IP (diagnóstico do proxy em Configurações). */
export function ipSource(headers: Headers): "x-real-ip" | "x-forwarded-for" | null {
  if (clean(headers.get("x-real-ip"))) return "x-real-ip";
  if (clean((headers.get("x-forwarded-for") ?? "").split(",").at(-1))) return "x-forwarded-for";
  return null;
}
