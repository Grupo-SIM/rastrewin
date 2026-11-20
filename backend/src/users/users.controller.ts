import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { authenticate, AuthGuard, type RequestAuth } from "../auth/auth.guard";
import { generateOtpCode, normalizePhone } from "../auth/phone.util";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter, enforce } from "../http/rate-limit";
import { checkoutUrlFor, checkoutUrlWithPrefill, expireIfPastDue, PLAN_IDS } from "../plans";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeTracking } from "../track/tracking";
import { toPublicUser } from "./user.view";
import { IsBrPhone, IsCpf } from "./validators";

class RegisterDto {
	@IsString() @MinLength(2) @MaxLength(120) name: string;
	@IsEmail() @MaxLength(254) email: string;
	@IsCpf() @MaxLength(14) cpf: string;
	@IsBrPhone() @MaxLength(20) phone: string;
	@IsString() @MinLength(2) @MaxLength(80) city: string;
	@IsString() @MinLength(3) @MaxLength(140) pix: string;
	@IsIn(PLAN_IDS) plan: string;
	/** Origem do visitante (t.js): src = trck_user_id, utm_*, fbc, fbp. Filtrado por sanitizeTracking. */
	@IsOptional() @IsObject() tracking?: Record<string, unknown>;
	/** Código que o navegador recebeu no cadastro anterior: prova que é a mesma pessoa reenviando o formulário. */
	@IsOptional() @IsString() @MaxLength(100) registrationToken?: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function sameToken(hash: string | null, token: string | undefined) {
	if (!hash || !token) return false;
	const a = Buffer.from(hash);
	const b = Buffer.from(sha256(token));
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Cadastro cria conta e dispara o checkout: poucos por IP, e o mesmo IP não troca dados de várias contas. */
const registerLimiter = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });
const otpLimiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 });

@Controller("users")
export class UsersController {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
	 * (e a criação da senha) só acontece quando o webhook de pagamento confirmar (ver PaymentsController).
	 *
	 * O e-mail não é prova de nada aqui (a rota é pública), então:
	 *  - Conta de quem NUNCA pagou: só quem tem o `registrationToken` (o navegador que fez o cadastro) a altera, para
	 *    corrigir dado ou trocar de plano. Sem ele nada é gravado: a resposta traz só o link de checkout, montado
	 *    com os dados ENVIADOS (nunca os da conta, que são de outra pessoa).
	 *  - Conta de quem JÁ pagou (tem senha ou pedido): só mexe quem está logado nela. Sem login, nada é
	 *    alterado e a resposta pede o login. Sem isso, qualquer um trocava o Pix e o telefone de um cliente.
	 * A resposta nunca traz dados da conta nem o id.
	 */
	@Post()
	async register(@Body() dto: RegisterDto, @Req() req: Request) {
		enforce(
			registerLimiter,
			rateLimitKey(req),
			"Muitas tentativas de cadastro. Tente de novo em alguns minutos.",
		);
		const checkoutUrl = checkoutUrlFor(dto.plan);
		if (!checkoutUrl) throw new BadRequestException("Checkout não configurado para este plano");
		const { tracking: rawTracking, registrationToken, ...data } = dto;
		const email = data.email.trim().toLowerCase();
		const city = data.city.trim();
		// Sem rastreamento novo (script bloqueado, por exemplo), mantém o que já estava gravado.
		const tracking = sanitizeTracking(rawTracking);

		const existing = await this.prisma.user.findUnique({ where: { email } });
		const everPaid = !!existing && (!!existing.password || !!existing.simpayOrderId);
		if (existing && everPaid) {
			const auth = await authenticate(this.prisma, req);
			if (auth?.sub !== existing.id) return { loginRequired: true };
		}
		if (existing && !everPaid && !sameToken(existing.registrationTokenHash, registrationToken)) {
			const submitted = { cpf: data.cpf, email, name: data.name, phone: data.phone };
			return { checkoutUrl: checkoutUrlWithPrefill(dto.plan, submitted) ?? checkoutUrl };
		}
		// Telefone novo: a verificação por WhatsApp não vale para o número antigo.
		const phoneChanged = !!existing && normalizePhone(existing.phone) !== normalizePhone(data.phone);
		const phoneReset = phoneChanged ? { otpCode: null, phoneVerified: false } : {};

		if (existing && (await expireIfPastDue(this.prisma, existing)) === "ACTIVE") {
			const { plan, ...profile } = data;
			const user = await this.prisma.user.update({
				data: {
					...profile,
					...phoneReset,
					city,
					email,
					pendingPlan: plan === existing.plan ? null : plan,
					...(tracking ? { tracking } : {}),
				},
				where: { id: existing.id },
			});
			return { checkoutUrl: checkoutUrlWithPrefill(dto.plan, user) ?? checkoutUrl };
		}

		// Quem já tem o código continua com ele (se a resposta se perdesse, um código trocado trancaria a pessoa
		// fora do próprio cadastro); cadastro novo recebe um código novo, que o navegador guarda e reenvia.
		const reuse = !!existing && sameToken(existing.registrationTokenHash, registrationToken);
		const newToken =
			reuse && registrationToken ? registrationToken : randomBytes(32).toString("base64url");
		const user = await this.prisma.user.upsert({
			create: {
				...data,
				city,
				email,
				registrationTokenHash: sha256(newToken),
				status: "PENDING",
				...(tracking ? { tracking } : {}),
			},
			update: {
				...data,
				...phoneReset,
				...(reuse ? {} : { registrationTokenHash: sha256(newToken) }),
				city,
				email,
				paidAt: null,
				pendingPlan: null,
				status: "PENDING",
				...(tracking ? { tracking } : {}),
			},
			where: { email },
		});
		return {
			checkoutUrl: checkoutUrlWithPrefill(dto.plan, user) ?? checkoutUrl,
			registrationToken: newToken,
		};
	}

	/** O próprio usuário (identificado pelo token, nunca por um id na URL). */
	@Get("me")
	@UseGuards(AuthGuard)
	async me(@Req() req: { auth: RequestAuth }) {
		const user = await this.prisma.user.findUnique({ where: { id: req.auth.sub } });
		if (!user) throw new BadRequestException("Usuário não encontrado");
		const status = await expireIfPastDue(this.prisma, user);
		return { ...toPublicUser({ ...user, status }), checkoutUrl: checkoutUrlWithPrefill(user.plan, user) };
	}

	/** Gera (ou reaproveita) o código que o usuário precisa mandar pro WhatsApp do rastrewin
	 * para validar o telefone. Idempotente enquanto não verificado, pra não mudar o código
	 * a cada tela aberta. */
	@Post("me/otp")
	@UseGuards(AuthGuard)
	async requestOtp(@Req() req: { auth: RequestAuth }) {
		enforce(otpLimiter, req.auth.sub);
		const id = req.auth.sub;
		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) throw new BadRequestException("Usuário não encontrado");
		if (user.phoneVerified) return { code: null, phoneVerified: true };
		const code = user.otpCode ?? generateOtpCode();
		if (!user.otpCode) await this.prisma.user.update({ data: { otpCode: code }, where: { id } });
		return { code, phoneVerified: false, whatsappNumber: process.env.WHATSAPP_OTP_NUMBER ?? "" };
	}
}
