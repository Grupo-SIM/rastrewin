/*
 * Datas e fuso horário do painel. O fuso vem de Configurações › Geral (settings.timezone)
 * e deve ser o MESMO da conta de anúncios da Meta, para os relatórios por dia baterem.
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC−3)" },
  { value: "America/Manaus", label: "Amazonas, Rondônia, Roraima (UTC−4)" },
  { value: "America/Cuiaba", label: "Mato Grosso (UTC−4)" },
  { value: "America/Campo_Grande", label: "Mato Grosso do Sul (UTC−4)" },
  { value: "America/Rio_Branco", label: "Acre (UTC−5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
  { value: "America/New_York", label: "Nova York (UTC−5/−4)" },
  { value: "Europe/Lisbon", label: "Lisboa (UTC+0/+1)" },
  { value: "UTC", label: "UTC" },
];

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const cache = new Map<string, Intl.DateTimeFormat>();

/** "02/11/2026, 19:06" no fuso informado (igual no servidor e no navegador: sem erro de hidratação). */
export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIMEZONE) {
  let fmt = cache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
    cache.set(timeZone, fmt);
  }
  return fmt.format(new Date(iso));
}
