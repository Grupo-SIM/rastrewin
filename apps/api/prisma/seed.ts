import { PrismaClient } from '@prisma/client';
import { CATALOG, freeEndTime, makeRaffleData, uniqueWinnerName } from '../src/mock';

const prisma = new PrismaClient();
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const TOTAL = 1000;
const OPEN = 70; // abertos agora (8 deles terminando em poucos minutos)
const RECENT_ENDED = 14; // encerrados nos últimos 25 min (ainda visíveis no painel)

async function main() {
  if (CATALOG.length < TOTAL + 200) throw new Error(`Catálogo pequeno: ${CATALOG.length}`);
  await prisma.entry.deleteMany();
  await prisma.raffle.deleteMany();
  // usuários cadastrados são mantidos; eles são reinscritos nos sorteios visíveis pelo discover

  const now = Date.now();
  const prizes = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, TOTAL); // todos diferentes
  const taken: number[] = [];
  const usedWinners = new Set<string>();
  const data: ReturnType<typeof makeRaffleData>[] = [];

  prizes.forEach((prize, i) => {
    let want: number;
    if (i < 8) want = now + rnd(25, 240) * 1000;
    else if (i < OPEN) want = now + rnd(5 * 60, 72 * 3600) * 1000;
    else if (i < OPEN + RECENT_ENDED) want = now - rnd(60, 25 * 60) * 1000;
    else want = now - rnd(31 * 60, 45 * 24 * 3600) * 1000; // histórico
    const end = freeEndTime(want, taken);
    taken.push(end);
    const dur = rnd(3, 72) * 3600 * 1000;
    const r = makeRaffleData(prize, new Date(end), dur);
    data.push(r);
  });

  // ganhador de todo sorteio já encerrado: do pool de usuários, sem repetir
  const withWinner = data.map((r) => {
    if (r.endsAt.getTime() > now) return { ...r, winnerName: null as string | null };
    const w = uniqueWinnerName(r.seed, usedWinners);
    usedWinners.add(w);
    return { ...r, winnerName: w };
  });

  await prisma.raffle.createMany({ data: withWinner });
  console.log(`Seed ok: ${TOTAL} sorteios (catálogo: ${CATALOG.length} prêmios), ${OPEN} abertos, ${usedWinners.size} ganhadores únicos`);
}

main().finally(() => prisma.$disconnect());
