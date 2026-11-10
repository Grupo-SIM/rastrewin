import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";
import type { Request } from "express";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter } from "../http/rate-limit";
import { PrivacyService, type PrivacyType } from "./privacy.service";

class RequestDto {
	@IsIn(["ACCESS", "DELETE"]) type: PrivacyType;
	@IsEmail() @MaxLength(254) email: string;
	@IsOptional() @IsString() @MaxLength(40) phone?: string;
}

class ConfirmDto {
	@IsString() @Length(20, 100) @Matches(/^[A-Za-z0-9_-]+$/) token: string;
}

/** O formulário é público e manda email: até 5 pedidos a cada 10 min por IP (IP confiável, ver client-ip.ts). */
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

/**
 * Direitos do titular (LGPD art. 18) — formulário em rastrewin.com/privacidade/solicitacao.
 *   POST /privacy/requests          { type: ACCESS | DELETE, email, phone? } → manda o link ao email
 *   POST /privacy/requests/confirm  { token } → executa (ver os dados ou excluí-los)
 */
@Controller("privacy")
export class PrivacyController {
	constructor(private readonly privacy: PrivacyService) {}

	@Post("requests")
	@HttpCode(200)
	async request(@Body() dto: RequestDto, @Req() req: Request) {
		if (!limiter.take(rateLimitKey(req)))
			throw new HttpException(
				"Muitos pedidos. Tente de novo em alguns minutos.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		await this.privacy.request(dto.type, dto.email, dto.phone);
		// Mesma resposta exista ou não cadastro: não revela quem é cliente.
		return { ok: true };
	}

	@Post("requests/confirm")
	@HttpCode(200)
	async confirm(@Body() dto: ConfirmDto, @Req() req: Request) {
		if (!limiter.take(rateLimitKey(req)))
			throw new HttpException(
				"Muitos pedidos. Tente de novo em alguns minutos.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		return this.privacy.confirm(dto.token);
	}
}
