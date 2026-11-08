/* Formatação pt-BR dos números do painel. */

const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, notation: "compact" });
const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, style: "percent" });
const moneyCache = new Map<string, Intl.NumberFormat>();

export function formatInt(n: number): string {
	return intFmt.format(n);
}

const bytesFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Tamanho em bytes no padrão do sistema (base 1024): 512 B, 12 KB, 3,4 MB, 1,2 GB. */
export function formatBytes(n: number): string {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let v = Math.max(0, n);
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${i === 0 ? intFmt.format(v) : bytesFmt.format(v)} ${units[i]}`;
}

export function formatCompact(n: number): string {
	return Math.abs(n) < 10_000 ? intFmt.format(n) : compactFmt.format(n);
}

export function formatMoney(n: number, currency = "BRL", compact = false): string {
	const key = `${currency}:${compact}`;
	let fmt = moneyCache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat("pt-BR", {
			currency,
			style: "currency",
			...(compact ? { maximumFractionDigits: 1, notation: "compact" } : {}),
		});
		moneyCache.set(key, fmt);
	}
	return fmt.format(n);
}

/** 0.1234 → "12,3%" */
export function formatPct(ratio: number | null): string {
	return ratio === null || !Number.isFinite(ratio) ? "—" : pctFmt.format(ratio);
}

/** ROAS: 2.345 → "2,35"; null → "—" */
export function formatRoas(r: number | null): string {
	return r === null || !Number.isFinite(r)
		? "—"
		: r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function ratio(part: number, whole: number): number | null {
	return whole > 0 ? part / whole : null;
}

/**
 * Variação relativa entre períodos.
 * - número: a variação (0,2 = +20%);
 * - "novo": antes era zero e agora tem valor (não há percentual);
 * - null: sem comparação, porque um dos lados não existe (ex.: conversão sem visitantes, ticket
 *   médio sem vendas).
 */
export type Delta = number | "novo" | null;

export function delta(current: number | null, previous: number | null): Delta {
	if (current === null || previous === null) return null;
	if (previous === 0) return current === 0 ? 0 : "novo";
	return (current - previous) / previous;
}

/** "+12,3%" / "−4%" / "0%" / "novo" / "sem comparação" */
export function formatDelta(d: Delta): string {
	if (d === null) return "sem comparação";
	if (d === "novo") return "novo";
	if (d === 0) return "0%";
	const s = pctFmt.format(Math.abs(d));
	return d > 0 ? `+${s}` : `−${s}`;
}

/** Formatação escolhida por nome (componentes cliente não recebem funções do servidor). */
export type ValueKind = "int" | "money";
export function formatValue(n: number, kind: ValueKind = "int", currency = "BRL"): string {
	return kind === "money" ? formatMoney(n, currency) : formatInt(n);
}

/** "2026-11-02" → "02/11" */
export function formatDayShort(ymd: string): string {
	return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** "2025-04-19" → "19/04/2025" */
export function formatDayLong(ymd: string): string {
	return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

/** Intervalo curto: "06/11" (um dia) ou "31/10 a 06/11". */
export function formatDayRangeShort(range: { from: string; to: string }): string {
	return range.from === range.to
		? formatDayShort(range.from)
		: `${formatDayShort(range.from)} a ${formatDayShort(range.to)}`;
}

const countryNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
export function countryName(code: string | null): string {
	if (!code) return "Desconhecido";
	try {
		return countryNames.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}
