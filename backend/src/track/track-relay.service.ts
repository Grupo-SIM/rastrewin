import { Injectable, Logger } from "@nestjs/common";
import { signBody } from "../payments/simintpay";
import { sanitizeTracking } from "./tracking";

const TIMEOUT_MS = 10_000;
const DELAYS_MS = [0, 2_000, 10_000]; // 3 tentativas

/**
 * Repassa ao track.rastrewin.com cada evento de venda recebido do SimIntPay, no MESMO formato
 * (o track valida o contrato da API de vendas), assinado com TRACK_WEBHOOK_SECRET.
 * - tracking: o do checkout tem prioridade; o guardado no cadastro preenche o que faltar
 *   (o checkout do SimIntPay ainda não repassa src/UTM).
 * - renewal: recompra de quem já tinha pago. O track grava, mas não envia à Meta/GA4.
 * Sem TRACK_WEBHOOK_URL/SECRET, não faz nada. Nunca lança erro nem loga dados pessoais.
 */
@Injectable()
export class TrackRelayService {
	private readonly logger = new Logger(TrackRelayService.name);

	relay(event: Record<string, unknown>, opts: { savedTracking?: unknown; renewal?: boolean }): void {
		const url = process.env.TRACK_WEBHOOK_URL?.trim();
		const secret = process.env.TRACK_WEBHOOK_SECRET?.trim();
		if (!url || !secret) return;

		const tracking = {
			...(sanitizeTracking(opts.savedTracking) ?? {}),
			...(sanitizeTracking(event.tracking) ?? {}),
		};
		const payload: Record<string, unknown> = { ...event, tracking };
		if (opts.renewal !== undefined) payload.renewal = opts.renewal;
		const body = JSON.stringify(payload);
		void this.send(url, secret, body, String(event.event), String(event.orderId));
	}

	private async send(url: string, secret: string, body: string, kind: string, orderId: string) {
		let lastError = "";
		for (const delay of DELAYS_MS) {
			if (delay) await new Promise(resolve => setTimeout(resolve, delay));
			try {
				const res = await fetch(url, {
					body,
					headers: {
						"content-type": "application/json",
						"x-simintpay-signature": signBody(body, secret),
					},
					method: "POST",
					redirect: "error",
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
				if (res.ok) return;
				lastError = `HTTP ${res.status}`;
				// 4xx (exceto 429) não melhora tentando de novo: assinatura/segredo ou payload.
				if (res.status < 500 && res.status !== 429) break;
			} catch (error) {
				lastError = error instanceof Error ? error.name : "erro";
			}
		}
		this.logger.warn(`Repasse ao track falhou (${kind}, pedido ${orderId}): ${lastError}`);
	}
}
