/*
 * Calendário das tentativas de envio da venda à Meta e ao GA4 (cada destino conta as suas).
 * Contado a partir da hora da venda: a 1ª tentativa é na hora (webhook), depois os intervalos
 * crescem até 12 h e seguem a cada 12 h até perto de 7 dias, o prazo da Conversions API.
 * Uma pane curta se resolve nas primeiras tentativas; uma pane de horas não faz a venda se perder.
 * Regra pura (sem banco): usada pelo reenvio automático, pelo detalhe da venda e pelo aviso do painel.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Momento de cada tentativa, contado da hora da venda. O índice é o número de tentativas já feitas. */
export const RETRY_OFFSETS_MS: readonly number[] = [
	0,
	5 * MINUTE,
	15 * MINUTE,
	30 * MINUTE,
	HOUR,
	2 * HOUR,
	4 * HOUR,
	8 * HOUR,
	12 * HOUR,
	// 24 h, 36 h, ..., 156 h (6,5 dias)
	...Array.from({ length: 12 }, (_, i) => (24 + 12 * i) * HOUR),
];

/** Tentativas por destino (21). Depois disso o reenvio automático desiste. */
export const MAX_ATTEMPTS = RETRY_OFFSETS_MS.length;

/** Os mesmos momentos em segundos, para a consulta do reenvio automático. */
export const RETRY_OFFSETS_SECONDS: readonly number[] = RETRY_OFFSETS_MS.map(ms => ms / 1000);

/** Hora da próxima tentativa automática; null quando já esgotou. Pode estar no passado (atrasada). */
export function nextAttemptAt(saleAt: Date, attempts: number): Date | null {
	if (attempts < 0 || attempts >= MAX_ATTEMPTS) return null;
	return new Date(saleAt.getTime() + (RETRY_OFFSETS_MS[attempts] ?? 0));
}

/** A tentativa seguinte já pode sair. */
export function isAttemptDue(saleAt: Date, attempts: number, now: Date): boolean {
	const next = nextAttemptAt(saleAt, attempts);
	return next !== null && next.getTime() <= now.getTime();
}
