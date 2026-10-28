import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueWinnerName } from '../mock';
import { ensureWinners, reservedNames } from '../raffles/raffles.controller';
import { planLimit } from '../plans';
import { AdminGuard } from '../auth/auth.guard';
import { toPublicUser } from '../users/user.view';

class UpdateRaffleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() winnerName?: string;
  @IsOptional() @IsString() winnerUserId?: string;
}

const WA_KEY = 'whatsappMessage';
const WA_DEFAULT = 'Olá, {nome}! Você foi o ganhador do sorteio "{sorteio}" ({site}). Podemos combinar a entrega do seu prêmio?';

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

class EndDto {
  @IsInt() @Min(0) inSeconds: number;
}

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sorteios em andamento (o que termina antes vem primeiro), paginados (`limit` até 100) e com busca por título ou site. */
  @Get('raffles')
  async list(@Query('q') q = '', @Query('offset') offset = '0', @Query('limit') limit = '50') {
    await ensureWinners(this.prisma);
    const term = q.trim();
    const where = {
      endsAt: { gt: new Date() }, // só os em andamento (a tela esconde os encerrados, então não podem ocupar a página)
      ...(term ? { OR: [{ title: { contains: term, mode: 'insensitive' as const } }, { site: { contains: term, mode: 'insensitive' as const } }] } : {}),
    };
    const o = Math.max(0, Number(offset) || 0);
    const l = Math.min(100, Math.max(1, Number(limit) || 50));
    const [items, total] = await Promise.all([
      this.prisma.raffle.findMany({ where, orderBy: { endsAt: 'asc' }, skip: o, take: l, include: { _count: { select: { entries: true } } } }),
      this.prisma.raffle.count({ where }),
    ]);
    // nome/telefone dos ganhadores desta página (o front monta o link do WhatsApp sem baixar todos os clientes)
    const ids = [...new Set(items.map((r) => r.winnerUserId).filter(Boolean) as string[])];
    const winners = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true } }) : [];
    const byId = new Map(winners.map((w) => [w.id, w]));
    return { items: items.map((r) => ({ ...r, winnerUser: r.winnerUserId ? byId.get(r.winnerUserId) ?? null : null })), total };
  }

  /** Modelo da mensagem de WhatsApp enviada ao ganhador. Variáveis: {nome} {sorteio} {site} {premio}. */
  @Get('whatsapp-message')
  async getMessage() {
    const s = await this.prisma.setting.findUnique({ where: { key: WA_KEY } });
    return { text: s?.value ?? WA_DEFAULT, isDefault: !s, defaultText: WA_DEFAULT };
  }

  @Put('whatsapp-message')
  async setMessage(@Body() dto: MessageDto) {
    await this.prisma.setting.upsert({ where: { key: WA_KEY }, update: { value: dto.text }, create: { key: WA_KEY, value: dto.text } });
    return { text: dto.text, isDefault: false, defaultText: WA_DEFAULT };
  }

  /** Busca leve de clientes para o seletor de ganhador (no máximo 50 por chamada). */
  @Get('users/options')
  async userOptions(@Query('q') q = '') {
    const term = q.trim();
    const rows = await this.prisma.user.findMany({
      where: { role: { not: 'ADMIN' }, ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {}) },
      orderBy: { name: 'asc' },
      take: 50,
      select: { id: true, name: true, email: true, plan: true },
    });
    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, plan: u.plan }));
  }

  /**
   * Clientes paginados (`limit` até 100; 5000 só para exportar CSV). Filtros no servidor: `q` (nome, e-mail, CPF,
   * telefone ou Pix), `plan` e `winners=1` (só quem já ganhou). Devolve também as contagens para a tela.
   */
  @Get('users')
  async users(
    @Query('q') q = '', @Query('plan') plan = 'all', @Query('city') city = 'all', @Query('winners') winners = '', @Query('offset') offset = '0',
    @Query('limit') limit = '50', @Query('export') exportAll = '',
  ) {
    const term = q.trim();
    // sorteios já encerrados em que algum cliente foi o ganhador
    const wonRows = await this.prisma.raffle.groupBy({ by: ['winnerUserId'], where: { winnerUserId: { not: null }, endsAt: { lte: new Date() } }, _count: { _all: true } });
    const winnerIds = wonRows.map((w) => w.winnerUserId as string);
    const prizesOf = new Map(wonRows.map((w) => [w.winnerUserId as string, w._count._all]));

    // a conta admin não é cliente: fora da lista, das contagens e dos filtros
    const planWhere = { role: { not: 'ADMIN' }, ...(plan !== 'all' ? { plan } : {}) };
    const cityWhere = city !== 'all' ? { city: { equals: city, mode: 'insensitive' as const } } : {};
    const where = {
      ...planWhere,
      ...cityWhere,
      ...(winners === '1' ? { id: { in: winnerIds } } : {}),
      ...(term
        ? {
            OR: ['name', 'email', 'cpf', 'phone', 'pix'].map((f) => ({ [f]: { contains: term, mode: 'insensitive' as const } })),
          }
        : {}),
    };
    const o = Math.max(0, Number(offset) || 0);
    const l = Math.min(exportAll ? 5000 : 100, Math.max(1, Number(limit) || 50));
    const [users, total, byPlan, byCity, winnerClients] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { paidAt: 'desc' }, skip: o, take: l }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['plan'], where: { role: { not: 'ADMIN' }, ...cityWhere }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['city'], where: { ...planWhere, city: { not: '' } }, _count: { _all: true } }),
      this.prisma.user.findMany({ where: { id: { in: winnerIds }, ...planWhere, ...cityWhere }, select: { id: true } }),
    ]);
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
          where: { winnerUserId: { in: users.map((u) => u.id) }, endsAt: { lte: new Date() } },
          orderBy: { endsAt: 'desc' },
          select: { id: true, title: true, site: true, prize: true, endsAt: true, winnerUserId: true },
        })
      : [];
    const winsOf = new Map<string, typeof won>();
    for (const w of won) winsOf.set(w.winnerUserId as string, [...(winsOf.get(w.winnerUserId as string) ?? []), w]);
    return {
      items: users.map((u) => ({ ...toPublicUser(u), limit: planLimit(u.plan), wins: winsOf.get(u.id) ?? [] })),
      total,
      planCounts: Object.fromEntries(byPlan.map((p) => [p.plan, p._count._all])),
      cityCounts: [...cities.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'pt-BR')),
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
  @Patch('raffles/:id')
  async setWinner(@Param('id') id: string, @Body() dto: UpdateRaffleDto) {
    await this.find(id);
    if (dto.winnerUserId) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.winnerUserId }, select: { role: true } });
      if (u?.role === 'ADMIN') throw new BadRequestException('A conta admin não pode ser ganhadora');
    }
    const data: { title?: string; winnerName?: string | null; winnerUserId?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.winnerName !== undefined) data.winnerName = dto.winnerName || null;
    if (dto.winnerUserId !== undefined) data.winnerUserId = dto.winnerUserId || null;
    return this.prisma.raffle.update({ where: { id }, data });
  }

  @Post('raffles/:id/draw')
  async draw(@Param('id') id: string) {
    const r = await this.find(id);
    const taken = await this.prisma.raffle.findMany({ where: { winnerName: { not: null }, NOT: { id } }, select: { winnerName: true } });
    // sorteio automático: só nomes do pool fictício, nunca um usuário real (esse só o admin escolhe, pelo PATCH)
    const name = uniqueWinnerName(r.seed, new Set([...taken.map((t) => t.winnerName as string), ...(await reservedNames(this.prisma))]));
    return this.prisma.raffle.update({ where: { id }, data: { winnerName: name, winnerUserId: null } });
  }

  /** Útil para testes: faz o sorteio terminar em N segundos. */
  @Post('raffles/:id/end')
  async end(@Param('id') id: string, @Body() dto: EndDto) {
    await this.find(id);
    return this.prisma.raffle.update({ where: { id }, data: { endsAt: new Date(Date.now() + dto.inSeconds * 1000) } });
  }
}
