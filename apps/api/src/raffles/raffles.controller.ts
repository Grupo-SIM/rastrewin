import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Raffle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { expireIfPastDue, planLimit } from '../plans';
import { materializeSchedule } from '../schedule';
import { maskedUser, normalize, participantAt, uniqueWinnerName, userIndex } from '../mock';

/** Janela máxima que a lista devolve (cobre qualquer fuso: o front pede desde a meia-noite do usuário). */
const MAX_LOOKBACK_MS = 36 * 3600 * 1000;
/** Quantos ganhadores recentes entram na checagem de "não repetir ganhador". */
const RECENT_WINNERS = 20_000;

export function toPublic(r: Raffle, entered: boolean) {
  const nowMs = Date.now();
  const ended = r.endsAt.getTime() <= nowMs;
  // o contador para de crescer quando o sorteio termina
  const elapsed = Math.max(0, Math.min(nowMs, r.endsAt.getTime()) - r.createdAt.getTime());
  return {
    id: r.id,
    title: r.title,
    prize: r.prize,
    site: r.site,
    siteColor: r.siteColor,
    siteEmoji: r.siteEmoji,
    seed: r.seed,
    startsAt: r.createdAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    participants: r.baseCount + Math.floor(elapsed / 1500),
    ended,
    winnerName: ended ? r.winnerName : null,
    winnerUserId: ended ? r.winnerUserId : null,
    entered,
  };
}

let lock: Promise<unknown> = Promise.resolve();
const serialized = <T,>(fn: () => Promise<T>) => {
  const run = lock.then(fn);
  lock = run.catch(() => null);
  return run;
};

/**
 * Nomes que o sorteio automático nunca pode usar: o nome mascarado de cada usuário cadastrado. Quem paga não é
 * sorteado sozinho — o ganhador automático vem só do pool fictício, e um usuário real só vira ganhador se o admin
 * o escolher (PATCH /admin/raffles/:id). Em cache por 60 s para não ler a tabela a cada chamada.
 */
let reserved: { at: number; names: Set<string> } | null = null;
export async function reservedNames(prisma: PrismaService) {
  if (reserved && Date.now() - reserved.at < 60_000) return reserved.names;
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  reserved = { at: Date.now(), names: new Set(users.map((u) => maskedUser(u.name, u.id))) };
  return reserved.names;
}

/** Todo sorteio encerrado ganha ganhador na hora (do pool de usuários, sem repetir os ganhadores recentes). */
export function ensureWinners(prisma: PrismaService) {
  return serialized(async () => {
    const pending = await prisma.raffle.findMany({ where: { endsAt: { lte: new Date() }, winnerName: null }, select: { id: true, seed: true } });
    if (!pending.length) return;
    const taken = await prisma.raffle.findMany({
      where: { winnerName: { not: null } }, orderBy: { endsAt: 'desc' }, take: RECENT_WINNERS, select: { winnerName: true },
    });
    // usados = ganhadores recentes + nomes de usuários reais (que só o admin pode definir como ganhador)
    const used = new Set([...taken.map((t) => t.winnerName as string), ...(await reservedNames(prisma))]);
    for (let i = 0; i < pending.length; i += 200) {
      await prisma.$transaction(
        pending.slice(i, i + 200).map((r) => {
          const name = uniqueWinnerName(r.seed, used);
          used.add(name);
          return prisma.raffle.update({ where: { id: r.id }, data: { winnerName: name } });
        }),
      );
    }
  });
}

@Controller('raffles')
export class RafflesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Usuário ativo + janela do dia (`since`, ISO; o front manda a meia-noite do usuário) + filtro base do plano. */
  private async scope(userId?: string, since?: string) {
    await materializeSchedule(this.prisma);
    await ensureWinners(this.prisma);
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true, status: true, expiresAt: true } });
    if (!user || (await expireIfPastDue(this.prisma, user)) !== 'ACTIVE') return null;
    const now = new Date();
    const floor = now.getTime() - MAX_LOOKBACK_MS;
    const from = new Date(Math.max(floor, Number(new Date(since ?? '')) || floor));
    // cada plano vê uma fração fixa da agenda: Básico 500, Pro 2.000 e VIP 5.000 sorteios por dia
    const base = { slot: { not: null }, bucket: { lt: planLimit(user.plan) }, createdAt: { gte: from, lte: now } };
    return { user, now, base };
  }

  /** Contagens do dia (barato: só COUNT). Todos = em andamento + encerrados; "ganhei" inclui qualquer dia. */
  @Get('summary')
  async summary(@Query('userId') userId?: string, @Query('since') since?: string) {
    const sc = await this.scope(userId, since);
    if (!sc) return { open: 0, ended: 0, total: 0, won: 0 };
    const [open, ended, won] = await Promise.all([
      this.prisma.raffle.count({ where: { ...sc.base, endsAt: { gt: sc.now } } }),
      this.prisma.raffle.count({ where: { ...sc.base, endsAt: { lte: sc.now } } }),
      this.prisma.raffle.count({ where: { winnerUserId: sc.user.id, endsAt: { lte: sc.now } } }),
    ]);
    return { open, ended, total: open + ended, won };
  }

  /**
   * Lista paginada (`offset`/`limit`, no máximo 200 por chamada). `tab`: open (termina antes primeiro), ended
   * (mais recentes primeiro), won (ganhos do usuário, qualquer dia) ou all (abertos e depois encerrados).
   * Resposta: { items, total, nextOffset } — nextOffset é null no fim da lista.
   */
  @Get()
  async list(
    @Query('userId') userId?: string, @Query('since') since?: string, @Query('tab') tab = 'all',
    @Query('offset') offset = '0', @Query('limit') limit = '24',
  ) {
    const empty = { items: [], total: 0, nextOffset: null as number | null };
    const sc = await this.scope(userId, since);
    if (!sc) return empty;
    const o = Math.max(0, Number(offset) || 0);
    const l = Math.min(200, Math.max(1, Number(limit) || 24));
    const open = { ...sc.base, endsAt: { gt: sc.now } };
    const ended = { ...sc.base, endsAt: { lte: sc.now } };
    const won = { winnerUserId: sc.user.id, endsAt: { lte: sc.now } };
    const page = (where: object, order: 'asc' | 'desc', skip: number, take: number) =>
      take > 0 ? this.prisma.raffle.findMany({ where, orderBy: { endsAt: order }, skip, take }) : Promise.resolve([] as Raffle[]);

    let rows: Raffle[];
    let total: number;
    if (tab === 'open') {
      [rows, total] = await Promise.all([page(open, 'asc', o, l), this.prisma.raffle.count({ where: open })]);
    } else if (tab === 'ended') {
      [rows, total] = await Promise.all([page(ended, 'desc', o, l), this.prisma.raffle.count({ where: ended })]);
    } else if (tab === 'won') {
      [rows, total] = await Promise.all([page(won, 'desc', o, l), this.prisma.raffle.count({ where: won })]);
    } else {
      const nOpen = await this.prisma.raffle.count({ where: open });
      const nEnded = await this.prisma.raffle.count({ where: ended });
      total = nOpen + nEnded;
      const fromOpen = Math.max(0, Math.min(l, nOpen - o));
      const [a, b] = await Promise.all([
        page(open, 'asc', o, fromOpen),
        page(ended, 'desc', Math.max(0, o - nOpen), l - fromOpen),
      ]);
      rows = [...a, ...b];
    }
    const next = o + rows.length;
    return { items: rows.map((r) => toPublic(r, true)), total, nextOffset: next < total ? next : null };
  }

  /** Posição e nome do usuário logado dentro da lista deste sorteio. */
  private async me(seed: number, userId?: string) {
    if (!userId) return null;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (!u) return null;
    return { index: userIndex(seed, userId), name: maskedUser(u.name, userId) };
  }

  @Get(':id/participants')
  async participants(@Param('id') id: string, @Query('offset') offset = '0', @Query('limit') limit = '30', @Query('userId') userId?: string) {
    const r = await this.prisma.raffle.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const o = Math.max(0, Number(offset) || 0);
    const l = Math.min(100, Math.max(1, Number(limit) || 30));
    const me = await this.me(r.seed, userId);
    const items = Array.from({ length: l }, (_, i) => (me && o + i === me.index ? me.name : participantAt(r.seed, o + i)));
    return { items, nextOffset: o + l, me };
  }

  /** Busca por nome na lista do sorteio (primeiras 5.000 posições + a posição do usuário). */
  @Get(':id/participants/search')
  async search(@Param('id') id: string, @Query('q') q = '', @Query('userId') userId?: string) {
    const r = await this.prisma.raffle.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const needle = normalize(q.trim());
    if (needle.length < 2) return { results: [] };
    const me = await this.me(r.seed, userId);
    const results: { index: number; name: string; me: boolean }[] = [];
    if (me && normalize(me.name).includes(needle)) results.push({ index: me.index, name: me.name, me: true });
    for (let i = 0; i < 5000 && results.length < 15; i++) {
      if (me && i === me.index) continue;
      const name = participantAt(r.seed, i);
      if (normalize(name).includes(needle)) results.push({ index: i, name, me: false });
    }
    return { results: results.sort((x, y) => x.index - y.index) };
  }

  /** "Buscando sorteios...": só garante que a agenda e os ganhadores estão em dia (a lista vem de GET /raffles). */
  @Post('discover')
  async discover() {
    await materializeSchedule(this.prisma);
    await ensureWinners(this.prisma);
    return [];
  }
}
