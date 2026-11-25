import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Logger,
	NotFoundException,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { AdminGuard, type RequestAuth } from "../auth/auth.guard";
import { uniqueWinnerName } from "../mock";
import { planLimit } from "../plans";
import { PrismaService } from "../prisma/prisma.service";
import { RECENT_WINNERS, reservedNames } from "../raffles/raffles.controller";
import { toAdminUser } from "../users/user.view";

class UpdateRaffleDto {
	@IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
	@IsOptional() @IsString() @MaxLength(120) winnerName?: string;
	@IsOptional() @IsString() @MaxLength(40) winnerUserId?: string;
}

/**
 * Filtro "Pagamento" da lista de clientes: `paid` = pagou e está com o plano ativo, `pending` = só se cadastrou
 * e não pagou, `expired` = já pagou e está sem acesso (reembolso, chargeback ou plano vencido). Plano vencido que
 * ainda consta ACTIVE (o status só vira EXPIRED quando o cliente volta a usar o site) já conta como expirado.
 */
type Payment = "paid" | "pending" | "expired";
function paymentWhere(payment: string, now: Date) {
	if (payment === "paid")
		return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], status: "ACTIVE" };
	if (payment === "pending") return { status: "PENDING" };
	if (payment === "expired")
		return { OR: [{ status: "EXPIRED" }, { expiresAt: { lte: now }, status: "ACTIVE" }] };
	return undefined;
}
const PAYMENT_OF_STATUS: Record<string, Payment> = { ACTIVE: "paid", EXPIRED: "expired", PENDING: "pending" };

const WA_KEY = "whatsappMessage";
const WA_DEFAULT =
	'Olá, {nome}! Você foi o ganhador do sorteio "{sorteio}" ({site}). Podemos combinar a entrega do seu prêmio?';

class MessageDto {
	@IsString() @MinLength(1) @MaxLength(1000) text: string;
}

class EndDto {
	@IsInt() @Min(0) @Max(86_400) inSeconds: number;
}

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
	private readonly logger = new Logger(AdminController.name);

	constructor(private readonly prisma: PrismaService) {}

	/** Sorteios em andamento (o que termina antes vem primeiro), paginados (`limit` até 100) e com busca por título ou site. */
	@Get("raffles")
	async list(@Query("q") q = "", @Query("offset") offset = "0", @Query("limit") limit = "50") {
		const term = q.trim().slice(0, 100);
		const where = {
			endsAt: { gt: new Date() }, // só os em andamento (a tela esconde os encerrados, então não podem ocupar a página)
			...(term
				? {
						OR: [
							{ title: { contains: term, mode: "insensitive" as const } },
							{ site: { contains: term, mode: "insensitive" as const } },
						],
					}
				: {}),
		};
		const o = Math.max(0, Number(offset) || 0);
		const l = Math.min(100, Math.max(1, Number(limit) || 50));
		const [items, total] = await Promise.all([
			this.prisma.raffle.findMany({
				include: { _count: { select: { entries: true } } },
				orderBy: { endsAt: "asc" },
				skip: o,
				take: l,
				where,
			}),
			this.prisma.raffle.count({ where }),
		]);
		// nome/telefone dos ganhadores desta página (o front monta o link do WhatsApp sem baixar todos os clientes)
		const ids = [...new Set(items.map(r => r.winnerUserId).filter(Boolean) as string[])];
		const winners = ids.length
			? await this.prisma.user.findMany({
					select: { id: true, name: true, phone: true },
					where: { id: { in: ids } },
				})
			: [];
		const byId = new Map(winners.map(w => [w.id, w]));
		return {
			items: items.map(r => ({
				...r,
				winnerUser: r.winnerUserId ? (byId.get(r.winnerUserId) ?? null) : null,
			})),
			total,
		};
	}

	/** Modelo da mensagem de WhatsApp enviada ao ganhador. Variáveis: {nome} {sorteio} {site} {premio}. */
	@Get("whatsapp-message")
	async getMessage() {
		const s = await this.prisma.setting.findUnique({ where: { key: WA_KEY } });
		return { defaultText: WA_DEFAULT, isDefault: !s, text: s?.value ?? WA_DEFAULT };
	}

	@Put("whatsapp-message")
	async setMessage(@Body() dto: MessageDto) {
		await this.prisma.setting.upsert({
			create: { key: WA_KEY, value: dto.text },
			update: { value: dto.text },
			where: { key: WA_KEY },
		});
		return { defaultText: WA_DEFAULT, isDefault: false, text: dto.text };
	}

	/** Busca leve de clientes para o seletor de ganhador (no máximo 50 por chamada). */
	@Get("users/options")
	async userOptions(@Query("q") q = "") {
		const term = q.trim().slice(0, 100);
		const rows = await this.prisma.user.findMany({
			orderBy: { name: "asc" },
			select: { email: true, id: true, name: true, plan: true },
			take: 50,
			where: {
				role: { not: "ADMIN" },
				...(term
					? {
							OR: [
								{ name: { contains: term, mode: "insensitive" } },
								{ email: { contains: term, mode: "insensitive" } },
							],
						}
					: {}),
			},
		});
		return rows.map(u => ({ email: u.email, id: u.id, name: u.name, plan: u.plan }));
	}

	/**
	 * Clientes paginados (`limit` até 100; 5000 só para exportar CSV). Filtros no servidor: `q` (nome, e-mail, CPF,
	 * telefone ou Pix), `plan`, `payment` (`paid`, `pending` ou `expired`, ver `paymentWhere`) e `winners=1` (só
	 * quem já ganhou). Devolve também as contagens para a tela.
	 */
	@Get("users")
	async users(
		@Req() req: { auth: RequestAuth },
		@Query("q") q = "",
		@Query("plan") plan = "all",
		@Query("payment") payment = "all",
		@Query("city") city = "all",
		@Query("winners") winners = "",
		@Query("offset") offset = "0",
		@Query("limit") limit = "50",
		@Query("export") exportAll = "",
	) {
		const term = q.trim().slice(0, 100);
		// sorteios já encerrados em que algum cliente foi o ganhador
		const wonRows = await this.prisma.raffle.groupBy({
			_count: { _all: true },
			by: ["winnerUserId"],
			where: { endsAt: { lte: new Date() }, winnerUserId: { not: null } },
		});
		const winnerIds = wonRows.map(w => w.winnerUserId as string);
		const prizesOf = new Map(wonRows.map(w => [w.winnerUserId as string, w._count._all]));

		// a conta admin não é cliente: fora da lista, das contagens e dos filtros
		const planWhere = { role: { not: "ADMIN" }, ...(plan !== "all" ? { plan } : {}) };
		const cityWhere = city !== "all" ? { city: { equals: city, mode: "insensitive" as const } } : {};
		const now = new Date();
		const byPayment = paymentWhere(payment, now);
		// o filtro de pagamento e a busca usam OR: ficam em AND para não se sobrescreverem
		const payWhere = byPayment ? { AND: [byPayment] } : {};
		const where = {
			...planWhere,
			...cityWhere,
			...(winners === "1" ? { id: { in: winnerIds } } : {}),
			AND: [
				...(byPayment ? [byPayment] : []),
				...(term
					? [
							{
								OR: ["name", "email", "cpf", "phone", "pix"].map(f => ({
									[f]: { contains: term, mode: "insensitive" as const },
								})),
							},
						]
					: []),
			],
		};
		const o = Math.max(0, Number(offset) || 0);
		const l = Math.min(exportAll ? 5000 : 100, Math.max(1, Number(limit) || 50));
		// Quem vê (e leva) o CPF e o Pix de todos os clientes fica registrado.
		if (exportAll) this.logger.warn(`Exportação de clientes pelo admin ${req.auth.sub}: até ${l} linhas`);
		const clientWhere = { role: { not: "ADMIN" }, ...cityWhere };
		const [users, total, byPlanStatus, pastDue, byCity, winnerClients] = await Promise.all([
			this.prisma.user.findMany({ orderBy: { paidAt: "desc" }, skip: o, take: l, where }),
			this.prisma.user.count({ where }),
			this.prisma.user.groupBy({ _count: { _all: true }, by: ["plan", "status"], where: clientWhere }),
			// ativos com o plano já vencido contam como expirados
			this.prisma.user.groupBy({
				_count: { _all: true },
				by: ["plan"],
				where: { ...clientWhere, expiresAt: { lte: now }, status: "ACTIVE" },
			}),
			this.prisma.user.groupBy({
				_count: { _all: true },
				by: ["city"],
				where: { ...planWhere, ...payWhere, city: { not: "" } },
			}),
			this.prisma.user.findMany({
				select: { id: true },
				where: { id: { in: winnerIds }, ...planWhere, ...payWhere, ...cityWhere },
			}),
		]);
		// Contagem por plano e situação: serve ao seletor de plano (respeita o pagamento escolhido), ao de
		// pagamento (respeita o plano escolhido) e ao total da aba (como antes, só a cidade).
		const perPlan = new Map<string, Record<Payment | "all", number>>();
		const add = (p: string, key: Payment | "all", n: number) => {
			const c = perPlan.get(p) ?? { all: 0, expired: 0, paid: 0, pending: 0 };
			c[key] += n;
			perPlan.set(p, c);
		};
		for (const r of byPlanStatus) {
			add(r.plan, "all", r._count._all);
			const kind = PAYMENT_OF_STATUS[r.status];
			if (kind) add(r.plan, kind, r._count._all);
		}
		for (const r of pastDue) {
			add(r.plan, "paid", -r._count._all);
			add(r.plan, "expired", r._count._all);
		}
		const bucket = byPayment ? (payment as Payment) : "all";
		const planCounts: Record<string, number> = {};
		const paymentCounts = { all: 0, expired: 0, paid: 0, pending: 0 };
		let clientTotal = 0;
		for (const [p, c] of perPlan) {
			clientTotal += c.all;
			if (c[bucket]) planCounts[p] = c[bucket];
			if (plan !== "all" && p !== plan) continue;
			for (const k of ["all", "expired", "paid", "pending"] as const) paymentCounts[k] += c[k];
		}
		// "Cuiabá" e "cuiabá" são a mesma cidade (o filtro também ignora a caixa)
		const cities = new Map<string, { city: string; count: number }>();
		for (const c of byCity) {
			const label = c.city;
			const key = label.toLowerCase();
			const cur = cities.get(key);
			cities.set(key, { city: cur?.city ?? label, count: (cur?.count ?? 0) + c._count._all });
		}
		// os prêmios (lista) só dos clientes desta página
		const won = users.length
			? await this.prisma.raffle.findMany({
					orderBy: { endsAt: "desc" },
					select: {
						endsAt: true,
						id: true,
						prize: true,
						site: true,
						title: true,
						winnerUserId: true,
					},
					where: { endsAt: { lte: new Date() }, winnerUserId: { in: users.map(u => u.id) } },
				})
			: [];
		const winsOf = new Map<string, typeof won>();
		for (const w of won)
			winsOf.set(w.winnerUserId as string, [...(winsOf.get(w.winnerUserId as string) ?? []), w]);
		return {
			cityCounts: [...cities.values()].sort(
				(a, b) => b.count - a.count || a.city.localeCompare(b.city, "pt-BR"),
			),
			clientTotal,
			items: users.map(u => ({
				...toAdminUser(u),
				limit: planLimit(u.plan),
				wins: winsOf.get(u.id) ?? [],
			})),
			paymentCounts,
			planCounts,
			total,
			winnerClients: winnerClients.length,
			winnerPrizes: winnerClients.reduce((a, u) => a + (prizesOf.get(u.id) ?? 0), 0),
		};
	}

	private async find(id: string) {
		const r = await this.prisma.raffle.findUnique({ where: { id } });
		if (!r) throw new NotFoundException();
		return r;
	}

	/** Edita o título e/ou define o ganhador (string vazia limpa). Só altera o que foi enviado. */
	@Patch("raffles/:id")
	async setWinner(@Param("id") id: string, @Body() dto: UpdateRaffleDto) {
		await this.find(id);
		if (dto.winnerUserId) {
			const u = await this.prisma.user.findUnique({
				select: { role: true },
				where: { id: dto.winnerUserId },
			});
			if (u?.role === "ADMIN") throw new BadRequestException("A conta admin não pode ser ganhadora");
		}
		const data: { title?: string; winnerName?: string | null; winnerUserId?: string | null } = {};
		if (dto.title !== undefined) data.title = dto.title.trim();
		if (dto.winnerName !== undefined) data.winnerName = dto.winnerName || null;
		if (dto.winnerUserId !== undefined) data.winnerUserId = dto.winnerUserId || null;
		return this.prisma.raffle.update({ data, where: { id } });
	}

	@Post("raffles/:id/draw")
	async draw(@Param("id") id: string) {
		const r = await this.find(id);
		// Só os ganhadores recentes, como no sorteio automático: todos os de sempre (milhões de linhas com o tempo)
		// iriam inteiros para a memória a cada clique.
		const taken = await this.prisma.raffle.findMany({
			orderBy: { endsAt: "desc" },
			select: { winnerName: true },
			take: RECENT_WINNERS,
			where: { NOT: { id }, winnerName: { not: null } },
		});
		// sorteio automático: só nomes do pool fictício, nunca um usuário real (esse só o admin escolhe, pelo PATCH)
		const name = uniqueWinnerName(
			r.seed,
			new Set([...taken.map(t => t.winnerName as string), ...(await reservedNames(this.prisma))]),
		);
		return this.prisma.raffle.update({ data: { winnerName: name, winnerUserId: null }, where: { id } });
	}

	/** Útil para testes: faz o sorteio terminar em N segundos. */
	@Post("raffles/:id/end")
	async end(@Param("id") id: string, @Body() dto: EndDto) {
		// Ferramenta de teste: em produção fica desligada, a menos que ENABLE_TEST_TOOLS=true.
		if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_TOOLS !== "true")
			throw new NotFoundException();
		await this.find(id);
		return this.prisma.raffle.update({
			data: { endsAt: new Date(Date.now() + dto.inSeconds * 1000) },
			where: { id },
		});
	}
}
