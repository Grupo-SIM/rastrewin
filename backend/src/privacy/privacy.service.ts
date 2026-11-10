import { createHmac, randomBytes } from "node:crypto";
import { BadGatewayException, BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { callTrackPrivacy } from "./track-privacy.client";

const TOKEN_TTL_MS = 30 * 60 * 1000;
/** Um email não recebe outro link antes disso (evita usar o formulário para encher a caixa de alguém). */
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_PER_EMAIL_PER_DAY = 5;
/** Pedidos de acesso e links nunca confirmados somem depois disso (o email deles é dado pessoal). */
const KEEP_REQUESTS_MS = 30 * 24 * 3600 * 1000;

export type PrivacyType = "ACCESS" | "DELETE";

function tokenHash(token: string) {
	return createHmac("sha256", process.env.JWT_SECRET ?? "")
		.update(`privacy:${token}`)
		.digest("hex");
}

/** Só os dígitos, sem o DDI 55: "+55 (11) 99999-8888" e "11999998888" são o mesmo telefone. */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
	const norm = (v: string) => {
		const d = v.replace(/\D/g, "").replace(/^0+/, "");
		return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
	};
	return !!a && !!b && norm(a).length >= 8 && norm(a) === norm(b);
}

/** Dados do cadastro que a pessoa pode ver (sem senha, códigos de verificação nem campos internos). */
function accountView(user: User, entries: number, wins: number) {
	return {
		assinatura: {
			pago_em: user.paidAt,
			plano: user.plan,
			situacao: user.status,
			vence_em: user.expiresAt,
		},
		cadastro: {
			cidade: user.city,
			cpf: user.cpf,
			criado_em: user.createdAt,
			email: user.email,
			nome: user.name,
			pix: user.pix,
			telefone: user.phone,
			telefone_verificado: user.phoneVerified,
		},
		origem_da_visita_no_cadastro: user.tracking,
		sorteios: { participacoes: entries, vencidos: wins },
	};
}

/**
 * Direitos do titular (LGPD art. 18): acesso e exclusão. O pedido só é executado depois que a pessoa
 * confirma pelo link enviado ao email: é a prova de que o email é dela.
 * O telefone só é usado se for o do cadastro desse email (senão alguém poderia confirmar o próprio
 * email e pedir os dados de outra pessoa pelo telefone).
 */
@Injectable()
export class PrivacyService {
	private readonly logger = new Logger(PrivacyService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
	) {}

	/** Sempre termina igual (não revela se o email tem cadastro). */
	async request(type: PrivacyType, rawEmail: string, phone?: string) {
		const email = rawEmail.trim().toLowerCase();
		// Limpeza: exclusões concluídas ficam (já sem email, como prova); o resto sai após 30 dias.
		await this.prisma.privacyRequest.deleteMany({
			where: {
				createdAt: { lt: new Date(Date.now() - KEEP_REQUESTS_MS) },
				OR: [{ type: "ACCESS" }, { completedAt: null }],
			},
		});
		const since = new Date(Date.now() - 24 * 3600 * 1000);
		const recent = await this.prisma.privacyRequest.findMany({
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
			where: { createdAt: { gte: since }, email },
		});
		if (recent.length >= MAX_PER_EMAIL_PER_DAY) return;
		if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return;

		const token = randomBytes(32).toString("base64url");
		await this.prisma.privacyRequest.create({
			data: {
				email,
				expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
				phone: phone?.trim() || null,
				tokenHash: tokenHash(token),
				type,
			},
		});
		const link = `${process.env.WEB_ORIGIN}/privacidade/solicitacao/confirmar?token=${encodeURIComponent(token)}`;
		void this.email.sendPrivacyConfirmation(email, type, link);
	}

	/** Executa o pedido confirmado. Token de uso único: depois de concluído não serve mais. */
	async confirm(token: string) {
		const req = await this.prisma.privacyRequest.findUnique({ where: { tokenHash: tokenHash(token) } });
		if (!req || req.completedAt || req.expiresAt.getTime() < Date.now()) {
			throw new BadRequestException("Link inválido, já usado ou vencido. Faça um novo pedido.");
		}
		const user = await this.prisma.user.findUnique({ where: { email: req.email } });
		// Telefone: o do cadastro desse email (verificado pela posse do email), nunca um digitado à toa.
		const phone = user?.phone || null;
		if (req.phone && !samePhone(req.phone, user?.phone)) {
			this.logger.warn(
				`Pedido de privacidade ${req.id}: telefone informado não é o do cadastro (ignorado)`,
			);
		}
		return req.type === "ACCESS"
			? this.access(req.id, req.email, phone, user)
			: this.erase(req.id, req.email, phone, user);
	}

	private async access(id: string, email: string, phone: string | null, user: User | null) {
		const track = await callTrackPrivacy<Record<string, unknown[]>>("export", { email, phone });
		if (!track.ok) {
			this.logger.warn(`Acesso ${id}: track falhou (${track.error})`);
			throw new BadGatewayException(
				"Não conseguimos reunir todos os dados agora. Tente de novo em alguns minutos.",
			);
		}
		const account = user
			? accountView(
					user,
					await this.prisma.entry.count({ where: { userId: user.id } }),
					await this.prisma.raffle.count({ where: { winnerUserId: user.id } }),
				)
			: null;
		await this.prisma.privacyRequest.update({ data: { completedAt: new Date() }, where: { id } });
		return {
			conta: account,
			gerado_em: new Date().toISOString(),
			navegacao_e_compras: track.data,
			tipo: "acesso",
		};
	}

	private async erase(id: string, email: string, phone: string | null, user: User | null) {
		// Primeiro o track: se ele falhar, nada é apagado aqui e a pessoa pode tentar de novo com o mesmo link.
		const track = await callTrackPrivacy<Record<string, number>>("erase", { email, phone });
		if (!track.ok) {
			this.logger.warn(`Exclusão ${id}: track falhou (${track.error})`);
			throw new BadGatewayException(
				"Não conseguimos concluir a exclusão agora. Tente de novo em alguns minutos.",
			);
		}
		let account = { cadastro_anonimizado: false, participacoes_apagadas: 0, repasses_apagados: 0 };
		if (user) {
			const [entries, , , relays] = await this.prisma.$transaction([
				this.prisma.entry.deleteMany({ where: { userId: user.id } }),
				// Vencedor continua registrado (o sorteio aconteceu), mas sem o nome da pessoa.
				this.prisma.raffle.updateMany({
					data: { winnerName: "Participante" },
					where: { winnerUserId: user.id },
				}),
				this.prisma.user.update({
					data: {
						city: "",
						cpf: "",
						email: `removido+${user.id}@invalid.local`,
						name: "Titular removido",
						otpCode: null,
						password: null,
						pendingPlan: null,
						phone: "",
						phoneVerified: false,
						pix: null,
						resetAttempts: 0,
						resetCodeExpiresAt: null,
						resetCodeHash: null,
						status: "EXPIRED",
						tracking: Prisma.DbNull,
					},
					where: { id: user.id },
				}),
				// Repasses ao track que o backend desistiu de enviar guardam o evento bruto (com o email).
				this.prisma.trackRelay.deleteMany({
					where: { body: { contains: email }, nextAttemptAt: null },
				}),
			]);
			account = {
				cadastro_anonimizado: true,
				participacoes_apagadas: entries.count,
				repasses_apagados: relays.count,
			};
		}
		const summary = { conta: account, rastreamento: track.data };
		await this.prisma.privacyRequest.update({
			// O email do pedido também é apagado: fica só a prova de que a exclusão foi feita, e quando.
			data: { completedAt: new Date(), email: `removido+${id}@invalid.local`, phone: null, summary },
			where: { id },
		});
		return { resumo: summary, tipo: "exclusao" };
	}
}
