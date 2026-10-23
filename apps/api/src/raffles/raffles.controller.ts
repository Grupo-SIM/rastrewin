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

/** Todo sorteio encerrado ganha ganhador na hora (do pool de usuários, sem repetir os ganhadores recentes). */
export function ensureWinners(prisma: PrismaService) {
  return serialized(async () => {
    const pending = await prisma.raffle.findMany({ where: { endsAt: { lte: new Date() }, winnerName: null }, select: { id: true, seed: true } });
    if (!pending.length) return;
    const taken = await prisma.raffle.findMany({
      where: { winnerName: { not: null } }, orderBy: { endsAt: 'desc' }, take: RECENT_WINNERS, select: { winnerName: true },
    });
    const used = new Set(taken.map((t) => t.winnerName as string));
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

  /**
   * Sorteios do plano do usuário (cada plano vê uma fração fixa da agenda: 500, 2.000 ou 5.000 por dia).
   * `since` = início da janela (ISO; o front manda a meia-noite do usuário). `after` = só o que mudou desde
   * esse instante (sorteios novos ou que acabaram de terminar); o front junta pelo id e evita baixar tudo a cada 3 s.
   * Os sorteios que o usuário ganhou aparecem sempre.
   */
  @Get()
  async list(@Query('userId') userId?: string, @Query('since') since?: string, @Query('after') after?: string) {
    await materializeSchedule(this.prisma);
    await ensureWinners(this.prisma);
    if (!userId) return [];
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true, status: true, expiresAt: true } });
    if (!user) return [];
    if ((await expireIfPastDue(this.prisma, user)) !== 'ACTIVE') return [];

    const now = Date.now();
    const floor = now - MAX_LOOKBACK_MS;
    const from = new Date(Math.max(floor, Number(new Date(since ?? '')) || floor));
    const changedAfter = after ? new Date(Math.max(floor, Number(after) || 0)) : null;
    const raffles = await this.prisma.raffle.findMany({
      where: {
        AND: [
          {
            OR: [
              { slot: { not: null }, bucket: { lt: planLimit(user.plan) }, createdAt: { gte: from, lte: new Date(now) } },
              { winnerUserId: userId },
            ],
          },
          ...(changedAfter
            ? [{ OR: [{ createdAt: { gt: changedAfter } }, { endsAt: { gt: changedAfter, lte: new Date(now) } }] }]
            : []),
        ],
      },
      orderBy: { endsAt: 'asc' },
    });
    return raffles.map((r) => toPublic(r, true));
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
