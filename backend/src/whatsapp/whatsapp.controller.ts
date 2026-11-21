import { createHash, timingSafeEqual } from "node:crypto";
import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpException,
	HttpStatus,
	Logger,
	Post,
	Query,
	Req,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { normalizePhone } from "../auth/phone.util";
import { rateLimitKey } from "../http/client-ip";
import { createRateLimiter } from "../http/rate-limit";
import { PrismaService } from "../prisma/prisma.service";

interface EvolutionMessage {
	key?: { remoteJid?: string; fromMe?: boolean };
	message?: { conversation?: string; extendedTextMessage?: { text?: string } };
}

/** Evolution manda poucas mensagens por pedido; um array enorme é abuso. */
const MAX_MESSAGES = 20;
/** Trava contra inundação da rota pública (o Evolution manda 1 pedido por mensagem recebida). */
const webhookLimiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 });

const sha = (v: string) => createHash("sha256").update(v).digest();

/** Segredo do webhook, no header `x-webhook-secret` ou em `?token=` na URL cadastrada na Evolution API.
 * Sem WHATSAPP_WEBHOOK_SECRET configurado, nunca aceita. */
function secretOk(provided: string | undefined) {
	const expected = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
	if (!expected || !provided) return false;
	return timingSafeEqual(sha(provided), sha(expected));
}

const last4 = (phone: string) => phone.slice(-4);

@Controller("whatsapp")
export class WhatsappController {
	private readonly logger = new Logger(WhatsappController.name);

	constructor(private readonly prisma: PrismaService) {}

	/** OTP reverso: usuário manda o código pro WhatsApp do rastrewin; aqui a gente confere
	 * se o remetente é o telefone cadastrado e se o texto bate com o código gerado.
	 * A Evolution API varia o shape entre versões (evento em maiúsculo/minúsculo, "data" como objeto ou
	 * array), então o corpo é lido à mão, com limites, em vez de por um DTO rígido. */
	@Post("webhook")
	@HttpCode(200)
	async webhook(
		@Body() body: unknown,
		@Req() req: Request,
		@Headers("x-webhook-secret") headerSecret?: string,
		@Query("token") querySecret?: string,
	) {
		if (!webhookLimiter.take(rateLimitKey(req)))
			throw new HttpException("Muitas requisições", HttpStatus.TOO_MANY_REQUESTS);
		if (!secretOk(headerSecret ?? (typeof querySecret === "string" ? querySecret : undefined)))
			throw new UnauthorizedException();

		if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: true };
		const { event, data } = body as { event?: unknown; data?: unknown };
		if (typeof event !== "string" || event.toLowerCase() !== "messages.upsert") return { ok: true };

		const messages = (Array.isArray(data) ? data : data ? [data] : []).slice(0, MAX_MESSAGES);
		for (const msg of messages) await this.handleMessage(msg as EvolutionMessage);
		return { ok: true };
	}

	private async handleMessage(msg: EvolutionMessage) {
		// Não filtra fromMe: quando a instância está logada no mesmo número que o usuário
		// usa para mandar o OTP (ex.: testes, "Mensagens para mim"), o Baileys sempre marca
		// fromMe=true nesse chat — não há como diferenciar de uma mensagem "recebida" ali.
		// Sem risco de loop: o bot nunca envia mensagens de texto de volta nesse webhook.
		if (!msg || typeof msg !== "object") return;
		const remoteJid = typeof msg.key?.remoteJid === "string" ? msg.key.remoteJid : "";
		const senderPhone = remoteJid.split("@")[0]?.replace(/\D/g, "");
		const raw = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text;
		const text = typeof raw === "string" ? raw.trim() : "";
		if (!senderPhone || senderPhone.length > 20 || !/^\d{6}$/.test(text)) return;

		const normalized = normalizePhone(senderPhone);
		const candidates = await this.prisma.user.findMany({
			select: { id: true, phone: true },
			where: { otpCode: text, phoneVerified: false },
		});
		const match = candidates.find(u => normalizePhone(u.phone) === normalized);
		if (!match) {
			// Nem o código nem o telefone inteiro vão para o log (dado pessoal).
			this.logger.warn(`OTP recebido de ...${last4(normalized)} sem usuário pendente correspondente`);
			return;
		}

		await this.prisma.user.update({
			data: { otpCode: null, phoneVerified: true },
			where: { id: match.id },
		});
		this.logger.log(`Telefone verificado para usuário ${match.id}`);
	}
}
