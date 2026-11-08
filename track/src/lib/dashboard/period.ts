/*
 * Período dos painéis, sempre no FUSO DO PAINEL (settings.timezone).
 * Intervalos meio-abertos [start, end) em UTC, prontos para o SQL.
 */

/** Mesma ordem do Gerenciador de Anúncios da Meta. Semana de domingo a sábado. */
export const PRESETS = [
	{ key: "hoje", label: "Hoje" },
	{ key: "ontem", label: "Ontem" },
	{ key: "hoje-ontem", label: "Hoje e ontem" },
	{ key: "7d", label: "Últimos 7 dias" },
	{ key: "14d", label: "Últimos 14 dias" },
	{ key: "28d", label: "Últimos 28 dias" },
	{ key: "30d", label: "Últimos 30 dias" },
	{ key: "90d", label: "Últimos 90 dias" },
	{ key: "semana", label: "Esta semana" },
	{ key: "semana-ant", label: "Semana passada" },
	{ key: "mes", label: "Este mês" },
	{ key: "mes-ant", label: "Mês passado" },
	{ key: "max", label: "Máximo" },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];
/** Período ao abrir o painel (sem ?periodo na URL) e quando o link traz um período inválido. */
export const DEFAULT_PRESET: PresetKey = "hoje";
const MAX_CUSTOM_DAYS = 366;

export interface Period {
	key: PresetKey | "custom";
	label: string;
	/** Datas locais (no fuso), inclusivas: "2026-10-04" … "2026-11-02" */
	from: string;
	to: string;
	days: number;
	start: Date;
	end: Date;
	prevStart: Date;
	prevEnd: Date;
	/** Datas locais do período anterior (iguais a from/to em "Máximo", que não compara). */
	prevFrom: string;
	prevTo: string;
	/** false em "Máximo": não há período anterior para comparar (prevStart = prevEnd = start). */
	compare: boolean;
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function tzOffsetMs(at: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(at);
	const n = (t: string) => Number(parts.find(p => p.type === t)?.value);
	return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at.getTime();
}

/** Data local "YYYY-MM-DD" de um instante, no fuso. */
export function localDate(at: Date, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).format(at);
}

/** Meia-noite local (no fuso) de uma data "YYYY-MM-DD", como instante UTC. */
export function startOfLocalDay(ymd: string, timeZone: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	const guess = Date.UTC(y, m - 1, d);
	let t = guess - tzOffsetMs(new Date(guess), timeZone);
	const corrected = guess - tzOffsetMs(new Date(t), timeZone); // horário de verão
	if (corrected !== t) t = corrected;
	return new Date(t);
}

export function addDays(ymd: string, days: number): string {
	const [y, m, d] = ymd.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function utcDay(ymd: string): number {
	const [y, m, d] = ymd.split("-").map(Number);
	return Date.UTC(y, m - 1, d); // mês do Date.UTC começa em 0
}

export function daysBetween(fromYmd: string, toYmd: string): number {
	return Math.round((utcDay(toYmd) - utcDay(fromYmd)) / 86_400_000);
}

/** Lista de datas locais do período (para preencher dias sem dados nos gráficos). */
export function daysOf(period: Pick<Period, "from" | "to">): string[] {
	const out: string[] = [];
	for (let d = period.from; d <= period.to; d = addDays(d, 1)) out.push(d);
	return out;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const fmtShort = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

/** Datas do período para exibição: "05/11/2026" (um dia) ou "07/10/2026 – 05/11/2026". */
export function periodRange(period: Pick<Period, "from" | "to">): string {
	return period.from === period.to
		? fmtShort(period.from)
		: `${fmtShort(period.from)} – ${fmtShort(period.to)}`;
}

/** Datas do período anterior; null em "Máximo", que não compara. */
export function previousDays(
	period: Pick<Period, "prevFrom" | "prevTo" | "compare">,
): { from: string; to: string } | null {
	if (!period.compare) return null;
	return { from: period.prevFrom, to: period.prevTo };
}

/** Primeiro dia do mês de uma data: "2026-11-08" → "2026-11-01". */
const monthStart = (ymd: string) => `${ymd.slice(0, 8)}01`;
/** Último dia do mês de uma data: "2026-02-10" → "2026-02-28". */
function monthEnd(ymd: string): string {
	const [y, m] = ymd.split("-").map(Number);
	return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Período de comparação:
 * - "Este mês" (dia 1 até hoje) → os MESMOS dias do mês anterior (01–08/11 → 01–08/10). Se o mês
 *   anterior for mais curto, para no último dia dele (01–31/03 → 01–28/02).
 * - "Mês passado" → o mês inteiro antes dele (outubro → setembro).
 * - Os demais (hoje, ontem, semanas, últimos N dias, personalizado) → o mesmo número de dias, logo antes.
 */
export function previousRange(
	key: Period["key"],
	from: string,
	to: string,
): { from: string; to: string } | null {
	if (key === "max") return null;
	if (key === "mes" || key === "mes-ant") {
		const prevFrom = monthStart(addDays(monthStart(from), -1));
		const last = monthEnd(prevFrom);
		if (key === "mes-ant") return { from: prevFrom, to: last };
		const sameDay = addDays(prevFrom, Number(to.slice(8, 10)) - 1);
		return { from: prevFrom, to: sameDay < last ? sameDay : last };
	}
	const days = daysBetween(from, to) + 1;
	return { from: addDays(from, -days), to: addDays(from, -1) };
}

/**
 * Os "Últimos N dias" terminam ONTEM (N dias inteiros antes de hoje), como no Gerenciador de
 * Anúncios da Meta: o mesmo filtro dá o mesmo gasto nos dois lugares.
 */
const LAST_DAYS: Partial<Record<PresetKey, number>> = { "7d": 7, "14d": 14, "28d": 28, "30d": 30, "90d": 90 };

/** Dia da semana de uma data local: 0 = domingo … 6 = sábado. */
function weekday(ymd: string): number {
	return new Date(utcDay(ymd)).getUTCDay();
}

/** Data mais antiga aceita em "Máximo": 37 meses atrás (limite dos insights da Meta), com 1 dia de folga. */
export function maxLookback(today: string): string {
	const [y, m, d] = today.split("-").map(Number);
	return addDays(new Date(Date.UTC(y, m - 1 - 37, d)).toISOString().slice(0, 10), 1);
}

function build(key: Period["key"], from: string, to: string, timeZone: string): Period {
	const days = daysBetween(from, to) + 1;
	const start = startOfLocalDay(from, timeZone);
	const end = startOfLocalDay(addDays(to, 1), timeZone);
	const prev = previousRange(key, from, to);
	const compare = prev !== null;
	const prevFrom = prev?.from ?? from;
	const prevTo = prev?.to ?? to;
	const prevStart = prev ? startOfLocalDay(prev.from, timeZone) : start;
	const prevEnd = prev ? startOfLocalDay(addDays(prev.to, 1), timeZone) : start;
	const label =
		key === "custom"
			? `${fmtShort(from)} – ${fmtShort(to)}`
			: (PRESETS.find(p => p.key === key)?.label ?? "");
	return { compare, days, end, from, key, label, prevEnd, prevFrom, prevStart, prevTo, start, to };
}

/** O mesmo período começando em outra data (usado por "Máximo" quando a Meta tem gasto mais antigo). */
export function withFrom(period: Period, from: string, timeZone: string): Period {
	return build(period.key, from, period.to, timeZone);
}

export function resolvePeriod(
	params: { periodo?: string | null; de?: string | null; ate?: string | null },
	timeZone: string,
	now: Date = new Date(),
	/** "Máximo": data local do dado mais antigo (sem dados = hoje). */
	firstDay: string | null = null,
): Period {
	const today = localDate(now, timeZone);
	const yesterday = addDays(today, -1);
	let key: Period["key"] =
		(PRESETS.find(p => p.key === params.periodo)?.key as PresetKey) ?? DEFAULT_PRESET;
	let from: string;
	let to = today;

	const de = params.de && YMD.test(params.de) ? params.de : null;
	const ate = params.ate && YMD.test(params.ate) ? params.ate : null;
	if (params.periodo === "custom" && de && ate && de <= ate && daysBetween(de, ate) < MAX_CUSTOM_DAYS) {
		key = "custom";
		from = de;
		to = ate;
	} else {
		switch (key) {
			case "hoje":
				from = today;
				break;
			case "ontem":
				from = to = yesterday;
				break;
			case "hoje-ontem":
				from = yesterday;
				break;
			case "semana":
				from = addDays(today, -weekday(today));
				break;
			case "semana-ant":
				to = addDays(today, -weekday(today) - 1);
				from = addDays(to, -6);
				break;
			case "mes":
				from = monthStart(today);
				break;
			case "mes-ant":
				to = addDays(monthStart(today), -1);
				from = monthStart(to);
				break;
			case "max": {
				const first = firstDay && YMD.test(firstDay) && firstDay < today ? firstDay : today;
				const floor = maxLookback(today);
				from = first < floor ? floor : first;
				break;
			}
			default:
				to = yesterday;
				from = addDays(yesterday, -((LAST_DAYS[key] ?? 30) - 1));
		}
	}
	return build(key, from, to, timeZone);
}
