import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { generatePassword, hashPassword } from "../auth/password.util";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

/** Payload do webhook enviado pelo simpay. "purchase_approved" vem de payment-link avulso;
 * "subscription_activated" é a 1ª cobrança de um link de assinatura paga via PIX;
 * "subscription_renewed" cobre tanto a 1ª cobrança via cartão quanto cada renovação anual
 * (mesmo payload para ambas); "subscription_expired" quando a assinatura é cancelada no gateway.
 * (ver back-simpay charge-payment-link.use-case.ts, process-dom-webhook.use-case.ts
 * [handleSubscriptionLinkPix] e subscription-webhook.service.ts) */
interface SimpayWebhookDto {
	event: string;
	customerEmail: string;
	orderId: string;
}

@Controller("payments")
export class PaymentsController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
	) {}

	@Post("webhook")
	async webhook(@Body() dto: SimpayWebhookDto, @Headers("x-simpay-token") token?: string) {
		const expected = process.env.SIMPAY_WEBHOOK_TOKEN;
		if (!expected || token !== expected) throw new UnauthorizedException("Token inválido");

		if (
			dto.event === "purchase_approved" ||
			dto.event === "subscription_renewed" ||
			dto.event === "subscription_activated"
		) {
			return this.activate(dto);
		}
		if (dto.event === "subscription_expired") {
			return this.expire(dto);
		}
		return { ok: true };
	}

	/** Libera (ou renova por +1 ano) o plano escolhido no cadastro. No primeiro pagamento
	 * também cria a senha de acesso e envia por e-mail. */
	private async activate(dto: SimpayWebhookDto) {
		if (!dto.customerEmail || !dto.orderId) throw new BadRequestException("Payload incompleto");

		// idempotência: a mesma cobrança (orderId) não processa duas vezes
		const already = await this.prisma.user.findUnique({ where: { simpayOrderId: dto.orderId } });
		if (already) return { ok: true };

		const email = dto.customerEmail.trim().toLowerCase();
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) return { ok: true }; // nada cadastrado com esse e-mail ainda; ignora

		const isFirstActivation = !user.password;
		const plainPassword = isFirstActivation ? generatePassword() : undefined;
		const now = new Date();
		// renovação de assinatura ainda ativa estende a partir do vencimento atual (não perde dias
		// se renovar antes de vencer); se já tinha expirado, conta a partir de agora.
		const base = user.expiresAt && user.expiresAt.getTime() > now.getTime() ? user.expiresAt : now;

		await this.prisma.user.update({
			data: {
				expiresAt: new Date(base.getTime() + ONE_YEAR_MS),
				paidAt: now,
				simpayOrderId: dto.orderId,
				status: "ACTIVE",
				...(plainPassword ? { password: await hashPassword(plainPassword) } : {}),
			},
			where: { id: user.id },
		});

		if (plainPassword) void this.email.sendWelcomeCredentials(user.email, user.name, plainPassword);

		return { ok: true };
	}

	/** Assinatura cancelada no gateway: perde acesso imediatamente, mesmo que o período pago
	 * ainda não tivesse vencido (ex.: cliente cancelou no meio do ano). */
	private async expire(dto: SimpayWebhookDto) {
		if (!dto.customerEmail) throw new BadRequestException("Payload incompleto");
		const email = dto.customerEmail.trim().toLowerCase();
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (user?.status !== "ACTIVE") return { ok: true };

		await this.prisma.user.update({ data: { status: "EXPIRED" }, where: { id: user.id } });
		return { ok: true };
	}
}
