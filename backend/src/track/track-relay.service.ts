import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { signBody } from "../payments/simintpay";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeTracking } from "./tracking";

const TIMEOUT_MS = 10_000;
const WORKER_INTERVAL_MS = 60_000;
const BATCH = 20;
/** ~3 dias de tentativas (backoff de 1 min até 6 h); a CAPI da Meta aceita vendas de até 7 dias. */
const MAX_ATTEMPTS = 20;
const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** (attempts - 1), 6 * 3600_000);
/** Quantas vendas desistidas vão no sinal (só ID do evento, tentativas e erro técnico). */
const FAILED_SAMPLE = 20;

type SendResult = { ok: true } | { ok: false; error: string; retry: boolean };

/**
 * Repassa ao track.rastrewin.com cada evento de venda recebido do SimIntPay, no MESMO formato
 * (o track valida o contrato da API de vendas), assinado com TRACK_WEBHOOK_SECRET.
 * - tracking: o do checkout tem prioridade; o guardado no cadastro preenche o que faltar
 *   (o checkout do SimIntPay ainda não repassa src/UTM).
 * - renewal: recompra de quem já tinha pago. O track grava, mas não envia à Meta/GA4.
 *
 * Entrega garantida: o repasse é gravado na tabela TrackRelay antes do envio e só sai de lá quando o
 * track confirma (2xx). Se o track estiver fora do ar, um worker reenvia a cada minuto com backoff
 * (até ~3 dias). O track deduplica por eventId, então reenviar nunca duplica a venda.
 * Sem TRACK_WEBHOOK_URL/SECRET, não faz nada. Nunca lança erro nem loga dados pessoais.
 *
 * Sinal de vida: a cada minuto, depois de drenar a fila, manda ao track a situação dela
 * (POST /api/webhook/relay-status, mesma assinatura): quantas vendas esperam, a mais antiga e as
 * que ele desistiu de enviar. A aba Saúde do painel avisa quando há atraso, desistência ou falta
 * de sinal. Se o usuário pedir "Tentar de novo" lá, a resposta traz retry_failed e as vendas
 * desistidas voltam para a fila.
 */
@Injectable()
export class TrackRelayService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TrackRelayService.name);
	private timer?: NodeJS.Timeout;
	private draining = false;
	/** Último resultado do sinal (para logar só quando muda, e não a cada minuto). */
	private heartbeatOk: boolean | null = null;

	constructor(private readonly prisma: PrismaService) {}

	onModuleInit() {
		this.timer = setInterval(() => void this.drain().then(() => this.heartbeat()), WORKER_INTERVAL_MS);
		this.timer.unref();
	}

	onModuleDestroy() {
		clearInterval(this.timer);
	}

	private config() {
		const url = process.env.TRACK_WEBHOOK_URL?.trim();
		const secret = process.env.TRACK_WEBHOOK_SECRET?.trim();
		return url && secret ? { secret, url } : null;
	}

	relay(event: Record<string, unknown>, opts: { savedTracking?: unknown; renewal?: boolean }): void {
		if (!this.config()) return;
		const tracking = {
			...(sanitizeTracking(opts.savedTracking) ?? {}),
			...(sanitizeTracking(event.tracking) ?? {}),
		};
		const payload: Record<string, unknown> = { ...event, tracking };
		if (opts.renewal !== undefined) payload.renewal = opts.renewal;
		void this.enqueueAndSend(String(event.eventId), JSON.stringify(payload));
	}

	private async enqueueAndSend(eventId: string, body: string) {
		try {
			// O mesmo evento reenviado pelo SimIntPay não substitui o que já está na fila.
			await this.prisma.trackRelay.upsert({
				create: { body, eventId },
				update: {},
				where: { eventId },
			});
		} catch {
			this.logger.warn(
				`Repasse ao track: não foi possível gravar na fila (evento ${eventId}); enviando direto`,
			);
			await this.send(body);
			return;
		}
		await this.attempt(eventId);
	}

	/** Reenvia os repasses vencidos. Um por vez por processo. */
	async drain() {
		if (this.draining || !this.config()) return;
		this.draining = true;
		try {
			const due = await this.prisma.trackRelay.findMany({
				orderBy: { nextAttemptAt: "asc" },
				select: { eventId: true },
				take: BATCH,
				where: { nextAttemptAt: { lte: new Date() } },
			});
			for (const { eventId } of due) await this.attempt(eventId);
		} catch (error) {
			this.logger.warn(
				`Repasse ao track: falha ao ler a fila (${error instanceof Error ? error.name : "erro"})`,
			);
		} finally {
			this.draining = false;
		}
	}

	/** Uma tentativa de entrega. Nunca lança: o envio imediato e o worker podem correr juntos. */
	private async attempt(eventId: string) {
		try {
			const row = await this.prisma.trackRelay.findUnique({ where: { eventId } });
			if (!row?.nextAttemptAt) return;
			const result = await this.send(row.body);
			if (result.ok) {
				await this.prisma.trackRelay.deleteMany({ where: { eventId } });
				return;
			}
			const attempts = row.attempts + 1;
			const giveUp = !result.retry || attempts >= MAX_ATTEMPTS;
			await this.prisma.trackRelay.updateMany({
				data: {
					attempts,
					lastError: result.error,
					nextAttemptAt: giveUp ? null : new Date(Date.now() + backoffMs(attempts)),
				},
				where: { eventId },
			});
			this.logger.warn(
				`Repasse ao track falhou (evento ${eventId}, tentativa ${attempts}): ${result.error}` +
					(giveUp ? " — sem novas tentativas" : ""),
			);
		} catch (error) {
			this.logger.warn(
				`Repasse ao track: erro na fila (evento ${eventId}): ${error instanceof Error ? error.name : "erro"}`,
			);
		}
	}

	/** Manda ao track a situação da fila. Nunca lança. */
	async heartbeat() {
		const config = this.config();
		if (!config) return;
		try {
			const [pending, failed, oldest, sample, last] = await Promise.all([
				this.prisma.trackRelay.count({ where: { nextAttemptAt: { not: null } } }),
				this.prisma.trackRelay.count({ where: { nextAttemptAt: null } }),
				this.prisma.trackRelay.findFirst({
					orderBy: { createdAt: "asc" },
					select: { createdAt: true },
					where: { nextAttemptAt: { not: null } },
				}),
				this.prisma.trackRelay.findMany({
					orderBy: { createdAt: "desc" },
					select: { attempts: true, createdAt: true, eventId: true, lastError: true },
					take: FAILED_SAMPLE,
					where: { nextAttemptAt: null },
				}),
				this.prisma.trackRelay.findFirst({
					orderBy: { createdAt: "desc" },
					select: { lastError: true },
					where: { lastError: { not: null }, nextAttemptAt: { not: null } },
				}),
			]);
			const body = JSON.stringify({
				failed,
				failed_sample: sample.map(r => ({
					attempts: r.attempts,
					created_at: r.createdAt.toISOString(),
					event_id: r.eventId,
					last_error: r.lastError?.slice(0, 300) ?? null,
				})),
				last_error: last?.lastError?.slice(0, 300) ?? null,
				oldest_pending_at: oldest?.createdAt.toISOString() ?? null,
				pending,
				sent_at: new Date().toISOString(),
				type: "relay_status",
			});
			const res = await fetch(new URL("/api/webhook/relay-status", config.url), {
				body,
				headers: {
					"content-type": "application/json",
					"x-simintpay-signature": signBody(body, config.secret),
				},
				method: "POST",
				redirect: "error",
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			this.logHeartbeat(res.ok, `HTTP ${res.status}`);
			if (!res.ok) return;
			const answer = (await res.json().catch(() => null)) as { retry_failed?: unknown } | null;
			if (answer?.retry_failed === true) {
				const { count } = await this.prisma.trackRelay.updateMany({
					data: { attempts: 0, nextAttemptAt: new Date() },
					where: { nextAttemptAt: null },
				});
				this.logger.log(`Repasse ao track: ${count} venda(s) de volta na fila (pedido do painel)`);
			}
		} catch (error) {
			const code = (error as { cause?: { code?: unknown } })?.cause?.code;
			this.logHeartbeat(
				false,
				typeof code === "string" ? code : error instanceof Error ? error.name : "erro",
			);
		}
	}

	private logHeartbeat(ok: boolean, detail: string) {
		if (ok === this.heartbeatOk) return;
		this.heartbeatOk = ok;
		if (ok) this.logger.log("Sinal ao track: entregue");
		else this.logger.warn(`Sinal ao track falhou (${detail}); o painel avisa se continuar sem sinal`);
	}

	private async send(body: string): Promise<SendResult> {
		const config = this.config();
		if (!config) return { error: "repasse desligado", ok: false, retry: false };
		try {
			const res = await fetch(config.url, {
				body,
				headers: {
					"content-type": "application/json",
					"x-simintpay-signature": signBody(body, config.secret),
				},
				method: "POST",
				redirect: "error",
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (res.ok) return { ok: true };
			// 4xx (exceto 429) não melhora tentando de novo: payload inválido.
			// 401 (segredo trocado no painel) e 503 (segredo ainda não gerado) se resolvem com configuração: tenta de novo.
			const retry = res.status >= 500 || res.status === 429 || res.status === 401;
			return { error: `HTTP ${res.status}`, ok: false, retry };
		} catch (error) {
			// fetch falha com TypeError genérico; o motivo (ECONNREFUSED, ENOTFOUND...) vem em cause.code.
			const code = (error as { cause?: { code?: unknown } })?.cause?.code;
			const reason = typeof code === "string" ? code : error instanceof Error ? error.name : "erro";
			return { error: reason, ok: false, retry: true };
		}
	}
}
