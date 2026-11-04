/*
 * Período dos painéis, sempre no FUSO DO PAINEL (settings.timezone).
 * Intervalos meio-abertos [start, end) em UTC, prontos para o SQL.
 */

export const PRESETS = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "mes", label: "Este mês" },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];
export const DEFAULT_PRESET: PresetKey = "30d";
const MAX_CUSTOM_DAYS = 366;

export type Period = {
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
};

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at.getTime();
}

/** Data local "YYYY-MM-DD" de um instante, no fuso. */
export function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
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

export function resolvePeriod(
  params: { periodo?: string | null; de?: string | null; ate?: string | null },
  timeZone: string,
  now: Date = new Date(),
): Period {
  const today = localDate(now, timeZone);
  let key: Period["key"] = (PRESETS.find((p) => p.key === params.periodo)?.key as PresetKey) ?? DEFAULT_PRESET;
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
        from = to = addDays(today, -1);
        break;
      case "7d":
        from = addDays(today, -6);
        break;
      case "90d":
        from = addDays(today, -89);
        break;
      case "mes":
        from = `${today.slice(0, 8)}01`;
        break;
      default:
        from = addDays(today, -29);
    }
  }

  const days = daysBetween(from, to) + 1;
  const start = startOfLocalDay(from, timeZone);
  const end = startOfLocalDay(addDays(to, 1), timeZone);
  const prevStart = startOfLocalDay(addDays(from, -days), timeZone);
  const label =
    key === "custom" ? `${fmtShort(from)} – ${fmtShort(to)}` : (PRESETS.find((p) => p.key === key)?.label ?? "");
  return { key, label, from, to, days, start, end, prevStart, prevEnd: start };
}
