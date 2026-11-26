/*
 * Mascaramento de dados pessoais para o Colaborador (src/lib/roles.ts). Fonte ÚNICA das regras.
 *
 * REGRA: toda tela ou action que mostra dado pessoal de cliente (nome, e-mail, telefone, IP,
 * corpo do webhook, payloads enviados à Meta/GA4) mascara NO SERVIDOR quando quem pede não é
 * Administrador. O dado completo nunca vai ao navegador do Colaborador.
 * Hoje: src/lib/dashboard/journey.ts, details.ts e revenue.ts (busca por e-mail).
 */

export const HIDDEN = "oculto";

/** "Marina Alves" → "M***** A****". */
export function maskName(value: string | null | undefined): string | null {
	if (!value?.trim()) return value ?? null;
	return value
		.trim()
		.split(/\s+/)
		.map(word => {
			const chars = Array.from(word);
			return chars[0] + "*".repeat(Math.max(chars.length - 1, 1));
		})
		.join(" ");
}

/** "marina.alves@gmail.com" → "m***@gmail.com". Sem "@" válido → só a 1ª letra. */
export function maskEmail(value: string | null | undefined): string | null {
	if (!value?.trim()) return value ?? null;
	const email = value.trim();
	const at = email.lastIndexOf("@");
	const first = Array.from(email)[0];
	if (at <= 0 || at === email.length - 1) return `${first}***`;
	return `${first}***${email.slice(at)}`;
}

/**
 * Mantém o DDD (e o 55 do país, se houver) e os 2 últimos dígitos; o resto vira "*",
 * preservando a pontuação: "(11) 98765-4321" → "(11) *****-**21".
 */
export function maskPhone(value: string | null | undefined): string | null {
	if (!value?.trim()) return value ?? null;
	const digits = value.replace(/\D/g, "");
	if (digits.length < 4) return "*".repeat(Math.max(value.length, 3));
	let keepStart = 0;
	if (digits.length >= 12 && digits.startsWith("55")) keepStart = 4;
	else if (digits.length === 10 || digits.length === 11) keepStart = 2;
	const keepEnd = 2;
	let index = 0;
	let out = "";
	for (const ch of value) {
		if (/\d/.test(ch)) {
			out += index < keepStart || index >= digits.length - keepEnd ? ch : "*";
			index += 1;
		} else out += ch;
	}
	return out;
}

/** IPv4 "187.45.120.33" → "187.45.*.*"; IPv6 → 2 primeiros grupos + ":*". Outro formato → "oculto". */
export function maskIp(value: string | null | undefined): string | null {
	if (!value?.trim()) return value ?? null;
	const ip = value.trim();
	const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
	if (v4) return `${v4[1]}.${v4[2]}.*.*`;
	if (ip.includes(":") && /^[0-9a-f:.]+$/i.test(ip)) {
		const groups = ip.split(":").filter(Boolean);
		if (groups.length >= 2) return `${groups[0]}:${groups[1]}:*`;
	}
	return HIDDEN;
}

/**
 * Chaves com dado pessoal (mesmo com hash: dá para conferir se batem com um e-mail conhecido)
 * nos payloads enviados à Meta (user_data) e ao GA4 (ip_override, user_data).
 * Ficam visíveis: fbc, fbp, client_user_agent, ids de evento e dados da compra.
 * "name" NÃO entra: é o nome do evento no GA4 (events[].name). O webhook bruto nem vai ao Colaborador.
 */
const PERSONAL_KEYS = new Set([
	"address",
	"client_ip_address",
	"country",
	"cpf",
	"ct",
	"customer_name",
	"customername",
	"db",
	"document",
	"em",
	"email",
	"external_id",
	"fn",
	"ge",
	"ip",
	"ip_override",
	"ln",
	"ph",
	"phone",
	"phone_number",
	"sha256_email_address",
	"sha256_first_name",
	"sha256_last_name",
	"sha256_phone_number",
	"sha256_street",
	"st",
	"zp",
]);

/** Cópia do JSON com os valores das chaves pessoais trocados por "oculto" (em qualquer profundidade). */
export function redactPersonal<T>(value: T): T {
	const walk = (node: unknown): unknown => {
		if (Array.isArray(node)) return node.map(walk);
		if (node && typeof node === "object") {
			return Object.fromEntries(
				Object.entries(node as Record<string, unknown>).map(([key, child]) => [
					key,
					PERSONAL_KEYS.has(key.toLowerCase()) &&
					child !== null &&
					child !== undefined &&
					child !== ""
						? HIDDEN
						: walk(child),
				]),
			);
		}
		return node;
	};
	return walk(value) as T;
}
