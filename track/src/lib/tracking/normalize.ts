import { createHash } from "node:crypto";
import { brStateToUf, stripAccents } from "@/lib/geo/br-states";

/*
 * Normalização + hash SHA-256 dos dados pessoais, conforme a doc da Meta
 * (Conversions API › Customer Information Parameters). Funções puras e testadas.
 */

export function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Já é um SHA-256 em hex? (não hashear duas vezes) */
export function isSha256(value: string) {
	return /^[a-f0-9]{64}$/.test(value);
}

export function normEmail(raw: string | null | undefined): string | null {
	const v = raw?.trim().toLowerCase();
	return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/**
 * Só dígitos, sem zeros à esquerda, com DDI.
 * Número que começa com "+" ou "00" já tem DDI. Sem isso, número BR (10/11 dígitos) ganha 55.
 */
export function normPhone(raw: string | null | undefined, defaultCountry = "BR"): string | null {
	if (!raw) return null;
	const international = /^\s*(\+|00)/.test(raw);
	let digits = raw.replace(/\D/g, "").replace(/^0+/, "");
	if (!international && defaultCountry === "BR" && (digits.length === 10 || digits.length === 11)) {
		digits = `55${digits}`;
	}
	return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Minúsculo, sem pontuação nem espaços; acentos mantidos (UTF-8), como "valéry". */
export function normName(raw: string | null | undefined): string | null {
	const v = raw
		?.trim()
		.toLowerCase()
		.replace(/[^\p{L}]/gu, "");
	return v || null;
}

/** "Maria Clara Souza" → { fn: "maria", ln: "souza" } */
export function splitFullName(full: string | null | undefined): { fn: string | null; ln: string | null } {
	const parts = full?.trim().split(/\s+/).filter(Boolean) ?? [];
	if (!parts.length) return { fn: null, ln: null };
	return { fn: normName(parts[0]), ln: parts.length > 1 ? normName(parts.at(-1)) : null };
}

/** Cidade: minúsculo, sem acentos, sem espaços/pontuação. "São Paulo" → "saopaulo" */
export function normCity(raw: string | null | undefined): string | null {
	const v = raw
		? stripAccents(raw)
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
		: "";
	return v || null;
}

/** Estado: no Brasil, a UF em minúsculo ("sp"); fora, o nome sem acento/espaço/pontuação. */
export function normState(raw: string | null | undefined, country: string | null | undefined): string | null {
	if (!raw) return null;
	if (country?.toUpperCase() === "BR") {
		const uf = brStateToUf(raw);
		if (uf) return uf.toLowerCase();
	}
	const v = stripAccents(raw)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
	return v || null;
}

/** País: ISO 3166-1 alpha-2 minúsculo ("br"). */
export function normCountry(raw: string | null | undefined): string | null {
	const v = raw?.trim().toLowerCase();
	return v && /^[a-z]{2}$/.test(v) ? v : null;
}

/** Normaliza e faz o hash; devolve null se não houver valor válido. */
export function hashed(value: string | null | undefined): string | null {
	if (!value) return null;
	return isSha256(value) ? value : sha256(value);
}
