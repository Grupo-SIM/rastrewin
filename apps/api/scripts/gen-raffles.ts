/**
 * Gera data/raffles.json: 20.000 sorteios diferentes (prêmio + site), em ordem embaralhada
 * e determinística. A API percorre essa lista em ciclo e grava a posição atual no banco.
 * Uso: npm run db:gen-raffles
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG, SITES } from '../src/mock';

const TOTAL = 20_000;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20_000);

/** Variações sobre o catálogo base até completar TOTAL prêmios únicos. */
const extras = [
  ' — edição limitada', ' — especial de aniversário', ' — sorteio relâmpago', ' — promoção de fim de semana',
  ' — edição colecionador', ' — oferta exclusiva para seguidores', ' — rodada bônus', ' — sorteio da semana',
  ' — promoção de lançamento', ' — super sorteio',
];
const prizes = [...CATALOG];
const seen = new Set(prizes);
for (const x of extras) {
  for (const p of CATALOG) {
    if (prizes.length >= TOTAL) break;
    const v = `${p}${x}`;
    if (!seen.has(v)) { seen.add(v); prizes.push(v); }
  }
}
if (prizes.length < TOTAL) throw new Error(`só ${prizes.length} prêmios únicos`);

// embaralha (Fisher-Yates) e corta em TOTAL
for (let i = prizes.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
}

// redes sociais pesam 6x, igual ao gerador antigo
const SOCIAL = new Set(['Instagram', 'Facebook', 'TikTok']);
const weighted = SITES.flatMap((s) => Array(SOCIAL.has(s.name) ? 6 : 1).fill(s.name) as string[]);

const out = prizes.slice(0, TOTAL).map((prize) => ({ prize, site: weighted[Math.floor(rand() * weighted.length)] }));
writeFileSync(join(__dirname, '../data/raffles.json'), JSON.stringify(out));
console.log(`${out.length} sorteios únicos gravados em data/raffles.json`);
