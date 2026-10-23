/** Limite de sorteios por plano (igual ao da API, em apps/api/src/plans.ts). */
const CAP: Record<string, number> = { basico: 500, pro: 2000, vip: 5000 };
const STEP_MS = 20_000; // a cada 20s o alvo sorteia um novo valor; entre eles o número desliza
const FLOOR = 0.9; // fica entre 90% e 100% do limite

const hash = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Número exibido em "sorteios que você participa": varia com o tempo perto do limite do plano e nunca o ultrapassa. */
export function shownParticipation(plan: string, nowMs: number): number | null {
  const cap = CAP[plan];
  if (!cap) return null;
  const b = Math.floor(nowMs / STEP_MS);
  const t = (nowMs % STEP_MS) / STEP_MS;
  const r = hash(b) * (1 - t) + hash(b + 1) * t;
  return Math.min(cap, Math.round(cap * (FLOOR + (1 - FLOOR) * r)));
}
