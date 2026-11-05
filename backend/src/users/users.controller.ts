import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { generateOtpCode } from "../auth/phone.util";
import { checkoutUrlFor, expireIfPastDue, PLAN_IDS } from "../plans";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeTracking } from "../track/tracking";
import { toPublicUser } from "./user.view";

class RegisterDto {
	@IsString() @MinLength(2) name: string;
	@IsEmail() email: string;
	@IsString() @MinLength(11) cpf: string;
	@IsString() @MinLength(8) phone: string;
	@IsString() @MinLength(2) city: string;
	@IsString() @MinLength(3) pix: string;
	@IsIn(PLAN_IDS) plan: string;
	/** Origem do visitante (t.js): src = trck_user_id, utm_*, fbc, fbp. Filtrado por sanitizeTracking. */
	@IsOptional() @IsObject() tracking?: Record<string, unknown>;
}

@Controller("users")
export class UsersController {
	constructor(private readonly prisma: PrismaService) {}

	/** Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
	 * (e a senha de acesso) só acontece quando o webhook de pagamento confirmar (ver PaymentsController).
	 * Quem já tem plano ATIVO não perde o acesso ao enviar o formulário de novo: os dados são
	 * atualizados e o plano escolhido fica em pendingPlan até o pagamento ser aprovado. */
	@Post()
	async register(@Body() dto: RegisterDto) {
		const checkoutUrl = checkoutUrlFor(dto.plan);
		if (!checkoutUrl) throw new BadRequestException("Checkout não configurado para este plano");
		const { tracking: rawTracking, ...data } = dto;
		const email = data.email.trim().toLowerCase();
		const city = data.city.trim();
		// Sem rastreamento novo (script bloqueado, por exemplo), mantém o que já estava gravado.
		const tracking = sanitizeTracking(rawTracking);

		const existing = await this.prisma.user.findUnique({ where: { email } });
		if (existing && (await expireIfPastDue(this.prisma, existing)) === "ACTIVE") {
			const { plan, ...profile } = data;
			const user = await this.prisma.user.update({
				data: {
					...profile,
					city,
					email,
					pendingPlan: plan === existing.plan ? null : plan,
					...(tracking ? { tracking } : {}),
				},
				where: { id: existing.id },
			});
			return { ...toPublicUser(user), checkoutUrl };
		}

		const user = await this.prisma.user.upsert({
			create: { ...data, city, email, status: "PENDING", ...(tracking ? { tracking } : {}) },
			update: {
				...data,
				city,
				email,
				paidAt: null,
				pendingPlan: null,
				status: "PENDING",
				...(tracking ? { tracking } : {}),
			},
			where: { email },
		});
		return { ...toPublicUser(user), checkoutUrl };
	}

	@Get(":id")
	async get(@Param("id") id: string) {
		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) throw new NotFoundException("Usuário não encontrado");
		const status = await expireIfPastDue(this.prisma, user);
		return { ...toPublicUser({ ...user, status }), checkoutUrl: checkoutUrlFor(user.plan) };
	}

	/** Gera (ou reaproveita) o código que o usuário precisa mandar pro WhatsApp do rastrewin
	 * para validar o telefone. Idempotente enquanto não verificado, pra não mudar o código
	 * a cada tela aberta. */
	@Post(":id/otp")
	async requestOtp(@Param("id") id: string) {
		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) throw new NotFoundException("Usuário não encontrado");
		if (user.phoneVerified) return { code: null, phoneVerified: true };
		const code = user.otpCode ?? generateOtpCode();
		if (!user.otpCode) await this.prisma.user.update({ data: { otpCode: code }, where: { id } });
		return { code, phoneVerified: false, whatsappNumber: process.env.WHATSAPP_OTP_NUMBER ?? "" };
	}
}
