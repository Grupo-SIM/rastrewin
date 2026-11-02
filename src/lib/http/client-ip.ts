import { isIP } from "node:net";

/*
 * IP do visitante. O app deve rodar atrás de um proxy reverso (nginx, Traefik, Cloudflare...)
 * que preencha estes headers. Ordem: cf-connecting-ip → x-real-ip → 1º IP válido do x-forwarded-for.
 */

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]")); // [ipv6]:porta
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0]; // ipv4:porta
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

/** IP do visitante (vai para a Meta e para a geo). */
export function clientIp(headers: Headers): string | null {
  const direct = clean(headers.get("cf-connecting-ip")) ?? clean(headers.get("x-real-ip"));
  if (direct) return direct;
  for (const part of (headers.get("x-forwarded-for") ?? "").split(",")) {
    const ip = clean(part);
    if (ip) return ip;
  }
  return null;
}

/**
 * Chave do rate limit. Usa o ÚLTIMO IP do x-forwarded-for (o que o NOSSO proxy anexou),
 * que o visitante não consegue forjar trocando o header — diferente do primeiro.
 */
export function rateLimitKey(headers: Headers): string {
  const cf = clean(headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((p) => clean(p)).filter(Boolean);
  return parts.at(-1) ?? clean(headers.get("x-real-ip")) ?? "unknown";
}
