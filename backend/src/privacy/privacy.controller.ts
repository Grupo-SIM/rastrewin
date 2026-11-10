import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";
import type { Request } from "express";
import { PrivacyService, type PrivacyType } from "./privacy.service";

class RequestDto {
	@IsIn(["ACCESS", "DELETE"]) type: PrivacyType;
	@IsEmail() @MaxLength(254) email: string;
	@IsOptional() @IsString() @MaxLength(40) phone?: string;
}

class ConfirmDto {
	@IsString() @Length(20, 100) @Matches(/^[A-Za-z0-9_-]+$/) token: string;
}

/** Limite simples por IP (memória do processo): o formulário é público e manda email. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function allow(ip: string) {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) return false;
	recent.push(now);
	hits.set(ip, recent);
	if (hits.size > 10_000) hits.clear();
	return true;
}
function clientIp(req: Request) {
	const real = req.headers["x-real-ip"];
	return (typeof real === "string" && real) || req.ip || "?";
}

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
		if (!allow(clientIp(req)))
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
		if (!allow(clientIp(req)))
			throw new HttpException(
				"Muitos pedidos. Tente de novo em alguns minutos.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		return this.privacy.confirm(dto.token);
	}
}
