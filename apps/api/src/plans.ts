import { PrismaService } from './prisma/prisma.service';

/** Planos: preço em R$/mês e limite de inscrições em sorteios por mês (calendário). */
export const PLANS = {
  basico: { name: 'Básico', price: 150, limit: 500 },
  pro: { name: 'Pro', price: 500, limit: 2000 },
  vip: { name: 'VIP', price: 1000, limit: 5000 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const planLimit = (plan: string) => PLANS[plan as PlanId]?.limit ?? 0;

/** Link de checkout do plano, configurável por ambiente (ex.: SIMPAY_CHECKOUT_URL_PRO). */
export const checkoutUrlFor = (plan: string) => process.env[`SIMPAY_CHECKOUT_URL_${plan.toUpperCase()}`];

export function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Inscrições feitas no mês corrente, por usuário. */
export async function usedThisMonth(prisma: PrismaService, userIds?: string[]) {
  const rows = await prisma.entry.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: monthStart() }, ...(userIds ? { userId: { in: userIds } } : {}) },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

/**
 * Inscreve o usuário nos sorteios (na ordem recebida) respeitando o limite mensal do plano.
 * Devolve os ids em que realmente entrou.
 */
export async function enroll(prisma: PrismaService, user: { id: string; plan: string }, raffleIds: string[]) {
  const have = new Set((await prisma.entry.findMany({ where: { userId: user.id, raffleId: { in: raffleIds } }, select: { raffleId: true } })).map((e) => e.raffleId));
  const fresh = raffleIds.filter((id) => !have.has(id));
  if (!fresh.length) return [];
  const used = (await usedThisMonth(prisma, [user.id])).get(user.id) ?? 0;
  const take = fresh.slice(0, Math.max(0, planLimit(user.plan) - used));
  if (take.length) await prisma.entry.createMany({ data: take.map((raffleId) => ({ userId: user.id, raffleId })), skipDuplicates: true });
  return take;
}
