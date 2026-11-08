import "server-only";
import { z } from "zod";
import type { RelayStatus } from "./evaluate";

/*
 * Sinal do backend sobre a fila de repasse de vendas (TrackRelayService). O backend manda a cada
 * minuto para POST /api/webhook/relay-status, assinado com o mesmo segredo das vendas. Só contagens
 * e erros técnicos, nunca dados de cliente.
 *
 * Fica em memória: depois que o app reinicia, a aba Saúde mostra "aguardando sinal" até o próximo
 * (no máximo 1 min). O pedido de "Tentar de novo" vai na RESPOSTA do sinal seguinte.
 */

const iso = z.iso.datetime({ offset: true });

export const relayStatusSchema = z.object({
	failed: z.number().int().nonnegative().max(1_000_000),
	failed_sample: z
		.array(
			z.object({
				attempts: z.number().int().nonnegative().max(1_000),
				created_at: iso,
				event_id: z.string().min(1).max(200),
				last_error: z.string().max(300).nullable(),
			}),
		)
		.max(20),
	last_error: z.string().max(300).nullable(),
	oldest_pending_at: iso.nullable(),
	pending: z.number().int().nonnegative().max(1_000_000),
	sent_at: iso,
	type: z.literal("relay_status"),
});
export type RelayStatusInput = z.infer<typeof relayStatusSchema>;

const g = globalThis as unknown as {
	__relayStatus?: { receivedAt: Date; status: RelayStatus };
	__relayRetry?: { requestedAt: Date; deliveredAt: Date | null };
};

/** Guarda o sinal e devolve se o backend deve recolocar na fila as vendas em que desistiu. */
export function recordRelayStatus(input: RelayStatusInput): { retryFailed: boolean } {
	g.__relayStatus = {
		receivedAt: new Date(),
		status: {
			failed: input.failed,
			failedSample: input.failed_sample.map(f => ({
				attempts: f.attempts,
				createdAt: f.created_at,
				eventId: f.event_id,
				lastError: f.last_error,
			})),
			lastError: input.last_error,
			oldestPendingAt: input.oldest_pending_at,
			pending: input.pending,
			sentAt: input.sent_at,
		},
	};
	const retry = g.__relayRetry;
	if (retry && !retry.deliveredAt) {
		retry.deliveredAt = new Date();
		return { retryFailed: true };
	}
	return { retryFailed: false };
}

export function lastRelayStatus(): { receivedAt: Date; status: RelayStatus } | null {
	return g.__relayStatus ?? null;
}

/** "Tentar de novo" do painel: vai ao backend na resposta do próximo sinal. */
export function requestRelayRetry() {
	g.__relayRetry = { deliveredAt: null, requestedAt: new Date() };
}

export function relayRetryState(): { requestedAt: string; deliveredAt: string | null } | null {
	const r = g.__relayRetry;
	return r
		? { deliveredAt: r.deliveredAt?.toISOString() ?? null, requestedAt: r.requestedAt.toISOString() }
		: null;
}
