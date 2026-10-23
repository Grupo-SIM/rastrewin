import { PrismaService } from './prisma/prisma.service';
import { feedItem, FEED_SIZE } from './feed';
import { SITES, titleOf } from './mock';

/**
 * Agenda de sorteios: a plataforma abre 5.000 sorteios por dia (um a cada 17,28 s), igual ao limite do
 * plano VIP. Cada plano enxerga uma fração fixa deles: Básico 500/dia, Pro 2.000/dia, VIP 5.000/dia
 * (o sorteio tem um `bucket` de 0 a 4999 e o plano vê os que têm bucket < limite).
 *
 * O sorteio da posição `slot` é calculado por fórmula (começa em slot × 17,28 s, dura de 30 min a 6 h),
 * então não depende de ninguém estar com a página aberta: a próxima chamada à API grava os que faltam.
 */
export const SLOT_MS = 17_280; // 86.400.000 ms / 5.000
export const SLOTS_PER_DAY = 5_000;
const MIN_DURATION_MS = 30 * 60 * 1000;
const SPREAD_DURATION_MS = 330 * 60 * 1000; // + até 5h30 => 30 min a 6 h
const FIRST_RUN_BACKFILL_MS = 24 * 3600 * 1000; // na primeira vez, já cria o dia anterior inteiro
const MAX_CATCHUP_MS = 48 * 3600 * 1000;
const STATE_KEY = 'slot';

const hash01 = (n: number, salt: number) => {
  let h = Math.imul((n + salt * 0x1f3d5b79) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 0..4999, espalhado de forma regular: em qualquer janela de 5.000 posições seguidas cada valor aparece uma vez. */
export const bucketOf = (slot: number) => (((slot % SLOTS_PER_DAY) + SLOTS_PER_DAY) % SLOTS_PER_DAY * 1237) % SLOTS_PER_DAY;

export function raffleForSlot(slot: number) {
  const startMs = slot * SLOT_MS;
  const item = feedItem(((slot % FEED_SIZE) + FEED_SIZE) % FEED_SIZE);
  const site = SITES.find((s) => s.name === item.site) ?? SITES[0];
  return {
    title: titleOf(item.prize),
    prize: item.prize,
    site: site.name,
    siteColor: site.color,
    siteEmoji: site.emoji,
    seed: 1 + Math.floor(hash01(slot, 3) * 2_000_000_000),
    baseCount: 1_200 + Math.floor(hash01(slot, 4) * 478_800),
    createdAt: new Date(startMs),
    endsAt: new Date(startMs + MIN_DURATION_MS + Math.floor(hash01(slot, 2) * SPREAD_DURATION_MS)),
    slot,
    bucket: bucketOf(slot),
  };
}

let lock: Promise<unknown> = Promise.resolve();
/** Grava os sorteios da agenda que já começaram e ainda não existem no banco. */
export function materializeSchedule(prisma: PrismaService) {
  const run = lock.then(async () => {
    const nowSlot = Math.floor(Date.now() / SLOT_MS);
    const state = await prisma.feedState.findUnique({ where: { key: STATE_KEY } });
    const from = state
      ? Math.max(state.position + 1, nowSlot - Math.floor(MAX_CATCHUP_MS / SLOT_MS))
      : nowSlot - Math.floor(FIRST_RUN_BACKFILL_MS / SLOT_MS);
    if (from > nowSlot) return;
    for (let s = from; s <= nowSlot; s += 1000) {
      const to = Math.min(nowSlot, s + 999);
      // idempotente sem constraint única: pula as posições que já existem
      const have = new Set((await prisma.raffle.findMany({ where: { slot: { gte: s, lte: to } }, select: { slot: true } })).map((r) => r.slot));
      const data = [];
      for (let i = s; i <= to; i++) if (!have.has(i)) data.push(raffleForSlot(i));
      if (data.length) await prisma.raffle.createMany({ data });
    }
    await prisma.feedState.upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, position: nowSlot }, update: { position: nowSlot } });
  });
  lock = run.catch(() => null);
  return run;
}
