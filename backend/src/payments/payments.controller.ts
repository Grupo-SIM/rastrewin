import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	HttpException,
	HttpStatus,
	Post,
	type RawBodyRequest,
	Req,
	UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Request } from "express";
import { generatePassword, hashPassword } from "../auth/password.util";
import { EmailService } from "../email/email.service";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter } from "../http/rate-limit";
import { PrismaService } from "../prisma/prisma.service";
import { TrackRelayService } from "../track/track-relay.service";
import { isValidSignature, parseSalesEvent, type SalesEvent } from "./simintpay";

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;
/** Trava contra inundação da rota pública. Bem acima do volume real (o SimIntPay manda 1 evento por
 * mudança de venda); ao estourar responde 429 e o SimIntPay reenvia depois. */
const webhookLimiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 });

/**
 * Webhook de vendas do SimIntPay (API de vendas, assinada). Rota pública:
 *   POST https://api.rastrewin.com/payments/webhook
 * Cadastrar no SimIntPay, na plataforma rastrewin: WEBHOOK_URL = essa rota e
 * WEBHOOK_SECRET = SIMPAY_WEBHOOK_SECRET deste backend.
 *
 * - purchase_approved: libera (ou estende por +1 ano) o plano escolhido no cadastro.
 * - purchase_refunded / chargeback: revoga o acesso da compra reembolsada.
 * - demais eventos: só são repassados ao track.
 * Todo evento válido é repassado ao track.rastrewin.com depois de processado (TrackRelayService).
 */
@Controller("payments")
export class PaymentsController {
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
		const event = parseSalesEvent(raw);
		if (!event) throw new BadRequestException("Payload inválido");

		const user = event.customerEmail
			? await this.prisma.user.findUnique({ where: { email: event.customerEmail } })
			: null;
		// Recompra/renovação = já tinha um pedido pago antes. Calculado ANTES de ativar.
		// (simpayOrderId e não paidAt: um novo cadastro zera o paidAt, mas nunca o simpayOrderId.)
		const renewal =
			event.event === "purchase_approved"
				? !!user?.simpayOrderId && user.simpayOrderId !== event.orderId
				: undefined;

		if (event.event === "purchase_approved" && user) await this.activate(event, user);
		if (event.event === "purchase_refunded" || event.event === "chargeback") await this.revoke(event);

		this.track.relay(raw, { renewal, savedTracking: user?.tracking });
		return { ok: true };
	}

	/** Libera (ou renova por +1 ano) o plano escolhido no cadastro. No primeiro pagamento
	 * também cria a senha de acesso e envia por e-mail. */
	private async activate(event: SalesEvent, user: User) {
		// idempotência: o mesmo pedido (orderId) não processa duas vezes
		const already = await this.prisma.user.findUnique({ where: { simpayOrderId: event.orderId } });
		if (already) return;

		const isFirstActivation = !user.password;
		const plainPassword = isFirstActivation ? generatePassword() : undefined;
		const now = new Date();
		// renovação de plano ainda ativo estende a partir do vencimento atual (não perde dias
		// se renovar antes de vencer); se já tinha expirado, conta a partir de agora.
		const base = user.expiresAt && user.expiresAt.getTime() > now.getTime() ? user.expiresAt : now;

		await this.prisma.user.update({
			data: {
				expiresAt: new Date(base.getTime() + ONE_YEAR_MS),
				paidAt: now,
				simpayOrderId: event.orderId,
				status: "ACTIVE",
				// Troca de plano de quem já era ativo: vale a partir deste pagamento.
				...(user.pendingPlan ? { pendingPlan: null, plan: user.pendingPlan } : {}),
				...(plainPassword ? { password: await hashPassword(plainPassword) } : {}),
			},
			where: { id: user.id },
		});

		if (plainPassword) void this.email.sendWelcomeCredentials(user.email, user.name, plainPassword);
	}

	/** Reembolso ou chargeback do pedido que liberou o plano: perde o acesso na hora.
	 * Reembolso de um pedido antigo (já substituído por uma renovação paga) não revoga. */
	private async revoke(event: SalesEvent) {
		const user = await this.prisma.user.findUnique({ where: { simpayOrderId: event.orderId } });
		if (user?.status !== "ACTIVE") return;
		await this.prisma.user.update({ data: { status: "EXPIRED" }, where: { id: user.id } });
	}
}
