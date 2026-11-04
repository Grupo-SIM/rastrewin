import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	Post,
	Req,
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../users/user.view";
import { AuthGuard } from "./auth.guard";
import { signToken } from "./jwt.util";
import { comparePassword, hashPassword } from "./password.util";

const RESET_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(email: string, code: string) {
	return createHmac("sha256", process.env.JWT_SECRET ?? "")
		.update(`${email}:${code}`)
		.digest("hex");
}

function sameHash(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

class LoginDto {
	@IsEmail() email: string;
	@IsString() @MinLength(1) password: string;
}

class ForgotDto {
	@IsEmail() email: string;
}

class CodeDto {
	@IsEmail() email: string;
	@IsString() @Length(6, 6) @Matches(/^\d{6}$/) code: string;
}

class ResetDto extends CodeDto {
	@IsString() @MinLength(8) @MaxLength(72) password: string;
}

class ChangePasswordDto {
	@IsString() @MinLength(1) currentPassword: string;
	@IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

@Controller("auth")
export class AuthController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
	) {}

	@Post("login")
	async login(@Body() dto: LoginDto) {
		const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
		if (!user?.password || !(await comparePassword(dto.password, user.password))) {
			throw new UnauthorizedException("E-mail ou senha inválidos");
		}
		const token = signToken({ role: user.role, sub: user.id });
		return { token, user: toPublicUser(user) };
	}

	/** Sempre responde ok, exista ou não a conta, pra não revelar quais e-mails são clientes. */
	@Post("forgot-password")
	async forgotPassword(@Body() dto: ForgotDto) {
		const email = dto.email.trim().toLowerCase();
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user?.password) return { ok: true };

		const issuedAgo = user.resetCodeExpiresAt
			? Date.now() - (user.resetCodeExpiresAt.getTime() - RESET_TTL_MS)
			: Number.POSITIVE_INFINITY;
		if (issuedAgo < RESEND_COOLDOWN_MS) return { ok: true };

		const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
		await this.prisma.user.update({
			data: {
				resetAttempts: 0,
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
	async verifyResetCode(@Body() dto: CodeDto) {
		await this.checkCode(dto.email.trim().toLowerCase(), dto.code);
		return { ok: true };
	}

	@Post("reset-password")
	async resetPassword(@Body() dto: ResetDto) {
		const email = dto.email.trim().toLowerCase();
		const user = await this.checkCode(email, dto.code);
		await this.prisma.user.update({
			data: {
				password: await hashPassword(dto.password),
				resetAttempts: 0,
				resetCodeExpiresAt: null,
				resetCodeHash: null,
			},
			where: { id: user.id },
		});
		return { ok: true };
	}

	@Post("change-password")
	@UseGuards(AuthGuard)
	async changePassword(@Req() req: { auth: { sub: string } }, @Body() dto: ChangePasswordDto) {
		const user = await this.prisma.user.findUnique({ where: { id: req.auth.sub } });
		if (!user?.password) throw new UnauthorizedException();
		if (!(await comparePassword(dto.currentPassword, user.password))) {
			throw new BadRequestException("Senha atual incorreta");
		}
		if (dto.currentPassword === dto.newPassword) {
			throw new BadRequestException("A nova senha deve ser diferente da atual");
		}
		await this.prisma.user.update({
			data: { password: await hashPassword(dto.newPassword) },
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
		if (user.resetAttempts >= MAX_ATTEMPTS) throw invalid;
		if (!sameHash(user.resetCodeHash, hashCode(email, code))) {
			await this.prisma.user.update({
				data: { resetAttempts: { increment: 1 } },
				where: { id: user.id },
			});
			throw invalid;
		}
		return user;
	}
}
