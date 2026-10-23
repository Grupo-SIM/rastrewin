/** Limite de sorteios por dia de cada plano (igual ao da API, em apps/api/src/plans.ts). */
const CAP: Record<string, number> = { basico: 500, pro: 2000, vip: 5000 };
const MINUTES = 24 * 60;

const hash = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Progresso do dia (0..1) em que cada minuto "rende" um peso aleatório, então o ritmo oscila sem nunca regredir. */
function progressAt(now: Date) {
  const day = now.getFullYear() * 1000 + Math.floor((Number(now) - Number(new Date(now.getFullYear(), 0, 1))) / 86_400_000);
  const minute = now.getHours() * 60 + now.getMinutes();
  const frac = (now.getSeconds() + now.getMilliseconds() / 1000) / 60;
  let done = 0;
  let total = 0;
  for (let m = 0; m < MINUTES; m++) {
    const w = 0.4 + hash(day * 1440 + m);
    total += w;
    if (m < minute) done += w;
    else if (m === minute) done += w * frac;
  }
  return done / total;
}

/**
 * "Sorteios que você participa hoje": começa em 0 à meia-noite, só cresce ao longo do dia e chega
 * a (limite − 1) no fim das 24h, quando zera de novo. Nunca ultrapassa o limite do plano.
 */
export function shownParticipation(plan: string, now: Date | number): number | null {
  const cap = CAP[plan];
  if (!cap) return null;
  const d = typeof now === 'number' ? new Date(now) : now;
  return Math.min(cap - 1, Math.floor((cap - 1) * progressAt(d)));
}
