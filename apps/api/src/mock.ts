const FIRST = ['Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Karina','Lucas','Mariana','Nicolas','Olívia','Pedro','Queila','Rafael','Sofia','Thiago','Úrsula','Vitor','Wesley','Yasmin','Zeca','Amanda','Caio','Daniela','Elias','Fernanda','Gustavo','Helena','Igor','Juliana','Kauê','Larissa','Murilo','Natália','Otávio','Patrícia'];
const LAST = ['Silva','Souza','Oliveira','Santos','Lima','Pereira','Costa','Ribeiro','Almeida','Gomes','Martins','Rocha','Carvalho','Araújo','Melo','Barbosa','Cardoso','Nunes','Teixeira','Moreira'];

export const SITES = [
  { name: 'SorteioMax', color: '#ff5a36', emoji: '🎯' },
  { name: 'PrêmioFácil', color: '#7c3aed', emoji: '🎁' },
  { name: 'LuckyBR', color: '#16a34a', emoji: '🍀' },
  { name: 'GanheJá', color: '#0ea5e9', emoji: '⚡' },
  { name: 'MegaRifa', color: '#e11d48', emoji: '🎰' },
  { name: 'TopPrêmios', color: '#f59e0b', emoji: '🏆' },
  { name: 'SorteiaAí', color: '#14b8a6', emoji: '🎲' },
  { name: 'CasaDoPrêmio', color: '#6366f1', emoji: '🏠' },
  { name: 'RifaBrasil', color: '#84cc16', emoji: '🇧🇷' },
  { name: 'PremiaMais', color: '#ec4899', emoji: '💎' },
];

const PRIZES = [
  'iPhone 15 Pro Max', 'PlayStation 5', 'R$ 10.000 no PIX', 'Moto Honda CG 0km', 'Smart TV 65" 4K',
  'Viagem para Cancún', 'Notebook Gamer', 'R$ 5.000 no PIX', 'Geladeira Frost Free', 'Carro 0km',
  'Apple Watch', 'Kit Home Office', 'Bicicleta Elétrica', 'Cruzeiro pelo Caribe', 'R$ 25.000 no PIX',
  'Air Fryer + Cooktop', 'Xbox Series X', 'Galaxy S24 Ultra', 'Vale-compras R$ 3.000', 'MacBook Air',
];

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]) => a[rnd(0, a.length - 1)];

export function makeRaffleData(short = false) {
  const site = pick(SITES);
  const prize = pick(PRIZES);
  const seconds = short ? rnd(25, 240) : rnd(5 * 60, 60 * 60 * 72);
  return {
    title: `Sorteio ${prize}`,
    prize,
    site: site.name,
    siteColor: site.color,
    siteEmoji: site.emoji,
    seed: rnd(1, 2_000_000_000),
    baseCount: rnd(1_200, 480_000),
    endsAt: new Date(Date.now() + seconds * 1000),
  };
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Participantes infinitos e determinísticos: o mesmo (seed, index) sempre dá o mesmo nome. */
export function participantAt(seed: number, index: number) {
  const r = mulberry32(seed ^ Math.imul(index + 1, 2654435761));
  const first = FIRST[Math.floor(r() * FIRST.length)];
  const last = LAST[Math.floor(r() * LAST.length)];
  const n = Math.floor(r() * 90) + 10;
  return `${first} ${last[0]}.${last.slice(1, 3)}*** #${n}`;
}

export function randomWinnerName(seed: number) {
  return participantAt(seed, rnd(0, 100_000));
}
