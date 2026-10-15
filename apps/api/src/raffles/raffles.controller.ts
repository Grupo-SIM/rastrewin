import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Raffle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { makeRaffleData, participantAt } from '../mock';

export function toPublic(r: Raffle, entered: boolean) {
  const ended = r.endsAt.getTime() <= Date.now();
  return {
    id: r.id,
    title: r.title,
    prize: r.prize,
    site: r.site,
    siteColor: r.siteColor,
    siteEmoji: r.siteEmoji,
    seed: r.seed,
    endsAt: r.endsAt.toISOString(),
    // contador de participantes cresce com o tempo (mock)
    participants: r.baseCount + Math.floor((Date.now() - r.createdAt.getTime()) / 1500),
    ended,
    winnerName: ended ? r.winnerName : null,
    winnerUserId: ended ? r.winnerUserId : null,
    entered,
  };
}

@Controller('raffles')
export class RafflesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('userId') userId?: string) {
    const raffles = await this.prisma.raffle.findMany({ orderBy: { endsAt: 'asc' } });
    const mine = userId
      ? new Set((await this.prisma.entry.findMany({ where: { userId }, select: { raffleId: true } })).map((e) => e.raffleId))
      : new Set<string>();
    return raffles.map((r) => toPublic(r, mine.has(r.id)));
  }

  @Get(':id/participants')
  async participants(@Param('id') id: string, @Query('offset') offset = '0', @Query('limit') limit = '30') {
    const r = await this.prisma.raffle.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const o = Math.max(0, Number(offset) || 0);
    const l = Math.min(100, Math.max(1, Number(limit) || 30));
    return { items: Array.from({ length: l }, (_, i) => participantAt(r.seed, o + i)), nextOffset: o + l };
  }

  /** "Buscando sorteios...": encontra novos sorteios e inscreve o usuário neles. */
  @Post('discover')
  async discover(@Query('userId') userId: string) {
    const count = 1 + Math.floor(Math.random() * 3);
    const created: Raffle[] = [];
    for (let i = 0; i < count; i++) {
      const r = await this.prisma.raffle.create({ data: makeRaffleData(Math.random() < 0.25) });
      created.push(r);
      if (userId) await this.prisma.entry.create({ data: { userId, raffleId: r.id } }).catch(() => null);
    }
    return created.map((r) => toPublic(r, !!userId));
  }
}
