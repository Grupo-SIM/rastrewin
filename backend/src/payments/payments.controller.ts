import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	HttpException,
	HttpStatus,
	Logger,
	Post,
	type RawBodyRequest,
	Req,
	UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Request } from "express";
import { EmailService } from "../email/email.service";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter } from "../http/rate-limit";
import { PrismaService } from "../prisma/prisma.service";
import { TrackRelayService } from "../track/track-relay.service";
import { acknowledgedOnlyEvent, isValidSignature, parseSalesEvent, type SalesEvent } from "./simintpay";

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;
/** Trava contra inundação da rota pública. Bem acima do volume real (o SimIntPay manda 1 evento por
 * mudança de venda); ao estourar responde 429 e o SimIntPay reenvia depois. */
const webhookLimiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 });
/** Eventos de um pedido novo (antes ou na aprovação), em que vale saber se é recompra. */
const RENEWAL_CHECK_EVENTS = new Set(["purchase_approved", "pix_generated", "card_declined"]);

/**
 * Webhook de vendas do SimIntPay (API de vendas, assinada). Rota pública:
 *   POST https://api.rastrewin.com/payments/webhook
 * Cadastrar no SimIntPay, na plataforma rastrewin: WEBHOOK_URL = essa rota e
 * WEBHOOK_SECRET = SIMPAY_WEBHOOK_SECRET deste backend.
 *
 * - purchase_approved: libera (ou estende por +1 ano) o plano escolhido no cadastro; no primeiro pagamento,
 *   manda o e-mail para o cliente criar a senha.
 * - purchase_refunded / chargeback: revoga o acesso da compra reembolsada.
 * - subscription_activated (oferta anual): só confirmado; o purchase_approved do mesmo pagamento
 *   é que libera o plano. Não vai ao track.
 * - demais eventos: só são repassados ao track.
 * Todo evento de venda válido é repassado ao track.rastrewin.com depois de processado (TrackRelayService).
 */
@Controller("payments")
export class PaymentsController {
	private readonly logger = new Logger(PaymentsController.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
		private readonly track: TrackRelayService,
	) {}

	@Post("webhook")
	@HttpCode(200)
	async webhook(@Req() req: RawBodyRequest<Request>, @Headers("x-simintpay-signature") signature?: string) {
		// Antes da assinatura: uma inundação nem chega a calcular o HMAC.
		if (!webhookLimiter.take(rateLimitKey(req)))
			throw new HttpException("Muitas requisições", HttpStatus.TOO_MANY_REQUESTS);
		if (!isValidSignature(req.rawBody, signature, process.env.SIMPAY_WEBHOOK_SECRET)) {
			throw new UnauthorizedException("Assinatura inválida");
		}

		let raw: Record<string, unknown>;
		try {
			raw = JSON.parse(req.rawBody!.toString("utf8"));
		} catch {
			throw new BadRequestException("JSON inválido");
		}
		const ackOnly = acknowledgedOnlyEvent(raw);
		if (ackOnly) {
			this.logger.log(`${ackOnly} confirmado sem efeito (o purchase_approved libera o plano)`);
			return { ignored: ackOnly, ok: true };
		}
		const event = parseSalesEvent(raw);
		if (!event) throw new BadRequestException("Payload inválido");

		const user = event.customerEmail
			? await this.prisma.user.findUnique({ where: { email: event.customerEmail } })
			: null;
		// Recompra/renovação = já tinha um pedido pago antes. Calculado ANTES de ativar.
		// (simpayOrderId e não paidAt: um novo cadastro zera o paidAt, mas nunca o simpayOrderId.)
		// Também no Pix gerado e no cartão recusado, que viram AddPaymentInfo na Meta só fora de renovação.
		// Nunca nos eventos depois da compra: o reembolso de um pedido antigo não pode virar "renovação".
		const renewal = RENEWAL_CHECK_EVENTS.has(event.event)
			? !!user?.simpayOrderId && user.simpayOrderId !== event.orderId
			: undefined;

		if (event.event === "purchase_approved" && user) await this.activate(event, user);
		if (event.event === "purchase_refunded" || event.event === "chargeback") await this.revoke(event);

		// Plano do cadastro (o escolhido agora, se já era cliente): id do produto na Meta e no GA4,
		// igual ao do InitiateCheckout do site.
		const plan =
			RENEWAL_CHECK_EVENTS.has(event.event) && user ? (user.pendingPlan ?? user.plan) : undefined;
		this.track.relay(raw, { plan, renewal, savedTracking: user?.tracking });
		return { ok: true };
	}

	/** Libera (ou renova por +1 ano) o plano escolhido no cadastro. No primeiro pagamento
	 * manda o e-mail para o cliente criar a senha (a senha nunca viaja por e-mail). */
	private async activate(event: SalesEvent, user: User) {
		// Pedido que já ativou alguém (reentrega depois de processado): nada a fazer.
		const already = await this.prisma.user.findUnique({ where: { simpayOrderId: event.orderId } });
		if (already) return;
		// Aviso mais antigo que o último pagamento já processado: é a reentrega de um pedido anterior
		// (já substituído por uma renovação). Estender de novo daria um ano de graça a cada reentrega.
		if (user.paidAt && Date.parse(event.occurredAt) < user.paidAt.getTime()) {
			this.logger.warn(`Aviso ${event.eventId} anterior ao último pagamento: ignorado`);
			return;
		}

		const isFirstActivation = !user.password && !user.simpayOrderId;
		const now = new Date();
		// renovação de plano ainda ativo estende a partir do vencimento atual (não perde dias
		// se renovar antes de vencer); se já tinha expirado, conta a partir de agora.
		const base = user.expiresAt && user.expiresAt.getTime() > now.getTime() ? user.expiresAt : now;

		// Idempotência atômica, na mesma transação: o mesmo evento (eventId) e o mesmo pedido (orderId) ativam
		// uma vez só, mesmo com dois avisos ao mesmo tempo. O UPDATE só pega a linha se ela ainda não tem este
		// orderId; o Postgres trava a linha e reavalia a condição, então o segundo aviso simultâneo atualiza 0
		// linhas e não envia outro e-mail.
		const activated = await this.prisma.$transaction(async tx => {
			const fresh = await tx.processedEvent.createMany({
				data: [{ eventId: event.eventId }],
				skipDuplicates: true,
			});
			if (fresh.count === 0) return false;
			const { count } = await tx.user.updateMany({
				data: {
					expiresAt: new Date(base.getTime() + ONE_YEAR_MS),
					paidAt: now,
					simpayOrderId: event.orderId,
					status: "ACTIVE",
					// Troca de plano de quem já era ativo: vale a partir deste pagamento.
					...(user.pendingPlan ? { pendingPlan: null, plan: user.pendingPlan } : {}),
				},
				where: {
					id: user.id,
					OR: [{ simpayOrderId: null }, { simpayOrderId: { not: event.orderId } }],
				},
			});
			return count > 0;
		});
		if (!activated) return;

		if (isFirstActivation) void this.email.sendWelcomeSetup(user.email, user.name);
	}

	/** Reembolso ou chargeback do pedido que liberou o plano: perde o acesso na hora.
	 * Reembolso de um pedido antigo (já substituído por uma renovação paga) não revoga. */
	private async revoke(event: SalesEvent) {
		const user = await this.prisma.user.findUnique({ where: { simpayOrderId: event.orderId } });
		if (user?.status !== "ACTIVE") return;
		await this.prisma.user.update({ data: { status: "EXPIRED" }, where: { id: user.id } });
	}
}
