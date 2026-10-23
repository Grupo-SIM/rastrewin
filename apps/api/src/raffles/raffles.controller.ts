import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Raffle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { enroll, expireIfPastDue } from '../plans';
import { freeEndTime, makeRaffleData, maskedUser, normalize, participantAt, uniqueWinnerName, userIndex } from '../mock';

/** Sorteios encerrados continuam visíveis por esse tempo; depois viram histórico. */
export const VISIBLE_AFTER_END_MS = 30 * 60 * 1000;
/** Quantidade de sorteios abertos que a plataforma mantém (proporção exibida ao usuário). */
const TARGET_OPEN = 70;
const FEED_KEY = 'raffles';
/** 20 mil sorteios diferentes (prêmio + site); a posição atual fica gravada no banco (FeedState). */
const FEED: { prize: string; site: string }[] = JSON.parse(readFileSync(join(__dirname, '../../data/raffles.json'), 'utf8'));
const DEMO_EVERY_MS = 4 * 60 * 1000;
let lastDemo = 0;

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

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

/** Todo sorteio encerrado ganha ganhador na hora (do pool de usuários, nunca repetido). */
export function ensureWinners(prisma: PrismaService) {
  return serialized(async () => {
    const pending = await prisma.raffle.findMany({ where: { endsAt: { lte: new Date() }, winnerName: null } });
    if (!pending.length) return;
    const taken = await prisma.raffle.findMany({ where: { winnerName: { not: null } }, select: { winnerName: true } });
    const used = new Set(taken.map((t) => t.winnerName as string));
    for (const r of pending) {
      const name = uniqueWinnerName(r.seed, used);
      used.add(name);
      await prisma.raffle.update({ where: { id: r.id }, data: { winnerName: name } });
    }
  });
}

/** Repõe sorteios novos para manter ~TARGET_OPEN abertos, na ordem do feed (data/raffles.json), sem terminar junto de outro. */
function replenish(prisma: PrismaService) {
  return serialized(async () => {
    const now = Date.now();
    const open = await prisma.raffle.findMany({ where: { endsAt: { gt: new Date(now) } }, select: { endsAt: true } });
    const wanted: number[] = []; // duração (ms) de cada novo sorteio
    for (let i = 0; i < Math.min(3, TARGET_OPEN - open.length); i++) wanted.push(rnd(2 * 3600, 72 * 3600) * 1000);
    if (now - lastDemo > DEMO_EVERY_MS) {
      lastDemo = now;
      wanted.push(rnd(40, 240) * 1000); // um sorteio curto de vez em quando, para o painel parecer vivo
    }
    if (!wanted.length) return [] as Raffle[];

    const taken = open.map((o) => o.endsAt.getTime());
    const created: Raffle[] = [];
    let position = (await prisma.feedState.findUnique({ where: { key: FEED_KEY } }))?.position ?? 0;
    for (const dur of wanted) {
      const item = FEED[position % FEED.length];
      position = (position + 1) % FEED.length;
      const end = freeEndTime(now + dur, taken);
      taken.push(end);
      const [raffle] = await prisma.$transaction([
        prisma.raffle.create({ data: makeRaffleData(item.prize, new Date(end), Math.max(dur, 60_000), item.site) }),
        prisma.feedState.upsert({ where: { key: FEED_KEY }, create: { key: FEED_KEY, position }, update: { position } }),
      ]);
      created.push(raffle);
    }
    return created;
  });
}

@Controller('raffles')
export class RafflesController {
  constructor(private readonly prisma: PrismaService) {}

  private visibleSince() {
    return new Date(Date.now() - VISIBLE_AFTER_END_MS);
  }

  @Get()
  async list(@Query('userId') userId?: string) {
    await ensureWinners(this.prisma);
    const raffles = await this.prisma.raffle.findMany({ where: { endsAt: { gt: this.visibleSince() } }, orderBy: { endsAt: 'asc' } });
    const mine = userId
      ? new Set((await this.prisma.entry.findMany({ where: { userId }, select: { raffleId: true } })).map((e) => e.raffleId))
      : new Set<string>();
    return raffles.map((r) => toPublic(r, mine.has(r.id)));
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

  /** "Buscando sorteios...": repõe sorteios e inscreve o usuário em tudo que está visível. */
  @Post('discover')
  async discover(@Query('userId') userId: string) {
    await replenish(this.prisma);
    await ensureWinners(this.prisma);
    if (!userId) return [];
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true, status: true, expiresAt: true } });
    if (!user) return [];
    const status = await expireIfPastDue(this.prisma, user);
    if (status !== 'ACTIVE') return [];
    const visible = await this.prisma.raffle.findMany({ where: { endsAt: { gt: this.visibleSince() } }, orderBy: { endsAt: 'asc' } });
    const added = new Set(await enroll(this.prisma, user, visible.map((r) => r.id)));
    return visible.filter((r) => added.has(r.id)).map((r) => toPublic(r, true));
  }
}
