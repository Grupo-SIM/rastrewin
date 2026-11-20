import { randomInt, timingSafeEqual } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpException,
	HttpStatus,
	Post,
	Req,
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { EmailService } from "../email/email.service";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter, enforce } from "../http/rate-limit";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../users/user.view";
import { AdminGuard, AuthGuard, type RequestAuth } from "./auth.guard";
import { signToken } from "./jwt.util";
import { comparePassword, DUMMY_HASH, hashPassword, isWeakPassword } from "./password.util";
import { hmacFor } from "./secrets.util";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "./totp.util";

const RESET_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
/** Erros de código de redefinição aceitos por conta a cada hora. NÃO zera ao pedir código novo: senão cada
 * pedido (um por minuto) devolveria as tentativas e o código de 6 dígitos seria adivinhado aos poucos. */
const MAX_ATTEMPTS_PER_HOUR = 10;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Login: no máximo 10 tentativas por minuto por IP e por e-mail (janela deslizante, na memória), mais 30 por
 * hora por e-mail. Segura rajadas e também quem tenta devagar uma senha por vez, sem travar quem erra a
 * senha algumas vezes. Senha certa ou errada contam igual.
 */
const LOGIN_LIMIT = { max: 10, windowMs: 60 * 1000 };
const loginByIp = createRateLimiter(LOGIN_LIMIT);
const loginByEmail = createRateLimiter(LOGIN_LIMIT);
const loginByEmailHour = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });
/** Esqueci a senha manda e-mail: sem limite por IP, daria para usar o nosso SMTP contra qualquer endereço. */
const forgotByIp = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const codeByIp = createRateLimiter({ max: 15, windowMs: 10 * 60 * 1000 });
const changeByUser = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

function hashCode(email: string, code: string) {
	return hmacFor("reset", "RESET_CODE_SECRET", `${email}:${code}`);
}

function sameHash(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

class LoginDto {
	@IsEmail() @MaxLength(254) email: string;
	@IsString() @MinLength(1) @MaxLength(200) password: string;
	/** Código do app autenticador; só pedido a quem ativou o 2FA (hoje, o admin). */
	@IsOptional() @IsString() @Length(6, 6) @Matches(/^\d{6}$/) totp?: string;
}

class ForgotDto {
	@IsEmail() @MaxLength(254) email: string;
}

class CodeDto {
	@IsEmail() @MaxLength(254) email: string;
	@IsString() @Length(6, 6) @Matches(/^\d{6}$/) code: string;
}

class ResetDto extends CodeDto {
	@IsString() @MinLength(8) @MaxLength(72) password: string;
}

class ChangePasswordDto {
	@IsString() @MinLength(1) @MaxLength(200) currentPassword: string;
	@IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

class TotpCodeDto {
	@IsString() @Length(6, 6) @Matches(/^\d{6}$/) code: string;
}

@Controller("auth")
export class AuthController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
	) {}

	@Post("login")
	@HttpCode(200)
	async login(@Body() dto: LoginDto, @Req() req: Request) {
		const email = dto.email.trim().toLowerCase();
		// Os contadores andam juntos: o de IP segura uma máquina testando várias contas,
		// o de e-mail segura uma conta atacada de vários lugares.
		const ipOk = loginByIp.take(rateLimitKey(req));
		const emailOk = loginByEmail.take(email);
		const hourOk = loginByEmailHour.take(email);
		if (!ipOk || !emailOk || !hourOk)
			throw new HttpException(
				"Muitas tentativas. Aguarde um minuto e tente de novo.",
				HttpStatus.TOO_MANY_REQUESTS,
			);

		const user = await this.prisma.user.findUnique({ where: { email } });
		// Conta inexistente também gasta o bcrypt: o tempo de resposta não revela quais e-mails são clientes.
		const passwordOk = await comparePassword(dto.password, user?.password ?? DUMMY_HASH);
		if (!user?.password || !passwordOk) throw new UnauthorizedException("E-mail ou senha inválidos");

		if (user.totpEnabled && user.totpSecret) {
			if (!dto.totp)
				throw new UnauthorizedException({
					message: "Informe o código do app autenticador",
					totpRequired: true,
				});
			const step = verifyTotp(user.totpSecret, dto.totp);
			if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep))
				throw new UnauthorizedException({
					message: "Código do autenticador inválido",
					totpRequired: true,
				});
			await this.prisma.user.update({ data: { totpLastStep: step }, where: { id: user.id } });
		}
		const token = signToken({ sub: user.id, tv: user.tokenVersion });
		return { token, user: toPublicUser(user) };
	}

	/** Sempre responde ok, exista ou não a conta, pra não revelar quais e-mails são clientes. */
	@Post("forgot-password")
	@HttpCode(200)
	async forgotPassword(@Body() dto: ForgotDto, @Req() req: Request) {
		enforce(forgotByIp, rateLimitKey(req), "Muitos pedidos. Tente de novo em alguns minutos.");
		const email = dto.email.trim().toLowerCase();
		const user = await this.prisma.user.findUnique({ where: { email } });
		// Quem acabou de pagar ainda não tem senha (cria a primeira por aqui); quem nunca pagou não entra.
		if (!user || (!user.password && user.status !== "ACTIVE")) return { ok: true };

		const issuedAgo = user.resetCodeExpiresAt
			? Date.now() - (user.resetCodeExpiresAt.getTime() - RESET_TTL_MS)
			: Number.POSITIVE_INFINITY;
		if (issuedAgo < RESEND_COOLDOWN_MS) return { ok: true };

		const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
		// resetAttempts de propósito NÃO é zerado aqui (ver MAX_ATTEMPTS_PER_HOUR).
		await this.prisma.user.update({
			data: {
				resetCodeExpiresAt: new Date(Date.now() + RESET_TTL_MS),
				resetCodeHash: hashCode(email, code),
			},
			where: { id: user.id },
		});
		await this.email.sendPasswordResetCode(email, user.name, code);
		return { ok: true };
	}

	/** Confere o código sem consumi-lo (a tela de nova senha reenvia o código no reset). */
	@Post("verify-reset-code")
	@HttpCode(200)
	async verifyResetCode(@Body() dto: CodeDto, @Req() req: Request) {
		enforce(codeByIp, rateLimitKey(req));
		await this.checkCode(dto.email.trim().toLowerCase(), dto.code);
		return { ok: true };
	}

	@Post("reset-password")
	@HttpCode(200)
	async resetPassword(@Body() dto: ResetDto, @Req() req: Request) {
		enforce(codeByIp, rateLimitKey(req));
		if (isWeakPassword(dto.password)) throw new BadRequestException("Escolha uma senha menos comum");
		const email = dto.email.trim().toLowerCase();
		const user = await this.checkCode(email, dto.code);
		await this.prisma.user.update({
			data: {
				password: await hashPassword(dto.password),
				resetAttempts: 0,
				resetCodeExpiresAt: null,
				resetCodeHash: null,
				resetWindowStart: null,
				// Derruba todas as sessões abertas com a senha antiga.
				tokenVersion: { increment: 1 },
			},
			where: { id: user.id },
		});
		return { ok: true };
	}

	@Post("change-password")
	@HttpCode(200)
	@UseGuards(AuthGuard)
	async changePassword(@Req() req: { auth: RequestAuth }, @Body() dto: ChangePasswordDto) {
		enforce(changeByUser, req.auth.sub);
		const user = await this.prisma.user.findUnique({ where: { id: req.auth.sub } });
		if (!user?.password) throw new UnauthorizedException();
		if (!(await comparePassword(dto.currentPassword, user.password))) {
			throw new BadRequestException("Senha atual incorreta");
		}
		if (dto.currentPassword === dto.newPassword) {
			throw new BadRequestException("A nova senha deve ser diferente da atual");
		}
		if (isWeakPassword(dto.newPassword)) throw new BadRequestException("Escolha uma senha menos comum");
		const updated = await this.prisma.user.update({
			data: { password: await hashPassword(dto.newPassword), tokenVersion: { increment: 1 } },
			where: { id: user.id },
		});
		// As outras sessões caem; esta continua com um token novo.
		return { ok: true, token: signToken({ sub: updated.id, tv: updated.tokenVersion }) };
	}

	/** 2FA do admin, passo 1: gera o segredo (ainda inativo) e devolve o endereço para o app autenticador. */
	@Post("totp/setup")
	@HttpCode(200)
	@UseGuards(AdminGuard)
	async totpSetup(@Req() req: { auth: RequestAuth }) {
		const user = await this.prisma.user.findUnique({ where: { id: req.auth.sub } });
		if (!user) throw new UnauthorizedException();
		if (user.totpEnabled) throw new BadRequestException("O 2FA já está ativo");
		const secret = generateTotpSecret();
		await this.prisma.user.update({ data: { totpSecret: secret }, where: { id: user.id } });
		return { otpauthUrl: otpauthUrl(secret, user.email), secret };
	}

	/** 2FA do admin, passo 2: confirma com um código do app e liga. Daí em diante o login exige o código. */
	@Post("totp/enable")
	@HttpCode(200)
	@UseGuards(AdminGuard)
	async totpEnable(@Req() req: { auth: RequestAuth }, @Body() dto: TotpCodeDto) {
		enforce(changeByUser, req.auth.sub);
		const user = await this.prisma.user.findUnique({ where: { id: req.auth.sub } });
		if (!user?.totpSecret || user.totpEnabled) throw new BadRequestException("Gere o segredo primeiro");
		const step = verifyTotp(user.totpSecret, dto.code);
		if (step === null) throw new BadRequestException("Código inválido");
		await this.prisma.user.update({
			data: { totpEnabled: true, totpLastStep: step },
			where: { id: user.id },
		});
		return { ok: true };
	}

	private async checkCode(email: string, code: string) {
		const invalid = new BadRequestException("Código inválido ou expirado");
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (
			!user?.resetCodeHash ||
			!user.resetCodeExpiresAt ||
			user.resetCodeExpiresAt.getTime() < Date.now()
		)
			throw invalid;
		const now = new Date();
		const windowOpen =
			!!user.resetWindowStart && now.getTime() - user.resetWindowStart.getTime() < ATTEMPT_WINDOW_MS;
		if (!windowOpen)
			await this.prisma.user.update({
				data: { resetAttempts: 0, resetWindowStart: now },
				where: { id: user.id },
			});
		// Conta a tentativa ANTES de comparar, de forma atômica: palpites em paralelo não furam o teto.
		const { count } = await this.prisma.user.updateMany({
			data: { resetAttempts: { increment: 1 } },
			where: { id: user.id, resetAttempts: { lt: MAX_ATTEMPTS_PER_HOUR } },
		});
		if (count === 0) throw invalid;
		if (!sameHash(user.resetCodeHash, hashCode(email, code))) throw invalid;
		return user;
	}
}
