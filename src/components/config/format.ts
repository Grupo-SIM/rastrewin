const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Data fixa em horário de Brasília (igual no servidor e no navegador: sem erro de hidratação). */
export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}
