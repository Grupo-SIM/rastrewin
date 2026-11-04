import { CATALOG, SITES } from "./mock";

/**
 * Feed de sorteios: cada posição 0..FEED_SIZE-1 vira um sorteio único (prêmio + edição + site), sem
 * repetir até dar a volta completa. É calculado por fórmula (permutação determinística), sem arquivo.
 * FEED_SIZE = prêmios do catálogo × 20 edições × sites ≈ 1,9 milhão, mais que o limite anual do VIP
 * (5.000/dia × 365 = 1,825 milhão). A posição atual fica gravada no banco (FeedState).
 */
const EDITIONS = [
	"",
	" — edição limitada",
	" — especial de aniversário",
	" — sorteio relâmpago",
	" — promoção de fim de semana",
	" — edição colecionador",
	" — oferta exclusiva para seguidores",
	" — rodada bônus",
	" — sorteio da semana",
	" — promoção de lançamento",
	" — super sorteio",
	" — edição de verão",
	" — edição de inverno",
	" — especial de fim de ano",
	" — mega sorteio",
	" — edição premium",
	" — sorteio surpresa",
	" — noite premiada",
	" — edição VIP",
	" — sorteio da sorte",
];

export const FEED_SIZE = CATALOG.length * EDITIONS.length * SITES.length;

const BITS = 22; // 2^22 = 4.194.304 >= FEED_SIZE; dividido em duas metades de 11 bits
const HALF = BITS / 2;
const MASK = (1 << HALF) - 1;
const KEYS = [0x9e3779b1, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];

const round = (r: number, k: number) => {
	let h = Math.imul(r ^ k, 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
	return (h ^ (h >>> 13)) & MASK;
};

/** Permutação bijetiva de 0..FEED_SIZE-1 (rede de Feistel + "cycle walking"): ordem embaralhada, sem repetir. */
function permute(p: number) {
	let x = p;
	do {
		let l = x >>> HALF;
		let r = x & MASK;
		for (const k of KEYS) [l, r] = [r, l ^ round(r, k)];
		x = (l << HALF) | r;
	} while (x >= FEED_SIZE);
	return x;
}

/** Sorteio da posição `position` do feed (dá a volta ao passar de FEED_SIZE). */
export function feedItem(position: number) {
	const idx = permute(((position % FEED_SIZE) + FEED_SIZE) % FEED_SIZE);
	const site = SITES[idx % SITES.length];
	const rest = Math.floor(idx / SITES.length);
	const prize = CATALOG[rest % CATALOG.length] + EDITIONS[Math.floor(rest / CATALOG.length)];
	return { prize, site: site.name };
}
