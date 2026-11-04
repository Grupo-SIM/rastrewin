import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { IsEmail, IsIn, IsString, MinLength } from "class-validator";
import { generateOtpCode } from "../auth/phone.util";
import { checkoutUrlFor, expireIfPastDue, PLAN_IDS } from "../plans";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "./user.view";

class RegisterDto {
	@IsString() @MinLength(2) name: string;
	@IsEmail() email: string;
	@IsString() @MinLength(11) cpf: string;
	@IsString() @MinLength(8) phone: string;
	@IsString() @MinLength(2) city: string;
	@IsString() @MinLength(3) pix: string;
	@IsIn(PLAN_IDS) plan: string;
}

@Controller("users")
export class UsersController {
	constructor(private readonly prisma: PrismaService) {}

	/** Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
	 * (e a senha de acesso) só acontece quando o webhook de pagamento confirmar (ver PaymentsController). */
	@Post()
	async register(@Body() dto: RegisterDto) {
		const checkoutUrl = checkoutUrlFor(dto.plan);
		if (!checkoutUrl) throw new BadRequestException("Checkout não configurado para este plano");
		const email = dto.email.trim().toLowerCase();
		const city = dto.city.trim();
		const user = await this.prisma.user.upsert({
			create: { ...dto, city, email, status: "PENDING" },
			update: { ...dto, city, email, paidAt: null, status: "PENDING" },
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
