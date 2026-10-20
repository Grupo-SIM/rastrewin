const FIRST = ['Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Karina','Lucas','Mariana','Nicolas','Olívia','Pedro','Queila','Rafael','Sofia','Thiago','Úrsula','Vitor','Wesley','Yasmin','Zeca','Amanda','Caio','Daniela','Elias','Fernanda','Gustavo','Helena','Igor','Juliana','Kauê','Larissa','Murilo','Natália','Otávio','Patrícia'];
const LAST = ['Silva','Souza','Oliveira','Santos','Lima','Pereira','Costa','Ribeiro','Almeida','Gomes','Martins','Rocha','Campos','Araújo','Melo','Barbosa','Cardoso','Nunes','Teixeira','Moreira'];

export const SITES = [
  // sites reais (com logo no painel)
  { name: 'Portal da Promo', color: '#e11d48', emoji: '🎁' },
  { name: 'Cidade de Prêmios', color: '#16a34a', emoji: '🏙️' },
  { name: 'Giro Premiado', color: '#f59e0b', emoji: '🎡' },
  { name: 'Clube dos Premiados', color: '#7c3aed', emoji: '🏆' },
  { name: 'Palpito', color: '#0ea5e9', emoji: '🔮' },
  { name: 'QualiBest', color: '#14b8a6', emoji: '📊' },
  { name: 'VocêOpina', color: '#6366f1', emoji: '💬' },
  { name: 'Toluna', color: '#2563eb', emoji: '🗳️' },
  { name: 'LifePoints', color: '#84cc16', emoji: '⭐' },
  { name: 'Swagbucks', color: '#0284c7', emoji: '💵' },
  { name: 'MOBROG', color: '#ea580c', emoji: '🎯' },
  { name: 'PrizeRebel', color: '#ff5a36', emoji: '🏅' },
  // redes sociais (sorteios de perfis/marcas mapeados nessas redes)
  { name: 'Instagram', color: '#E1306C', emoji: '📷' },
  { name: 'Facebook', color: '#1877F2', emoji: '👍' },
  { name: 'TikTok', color: '#000000', emoji: '🎵' },
];

/** Instagram, Facebook e TikTok concentram boa parte dos sorteios mapeados (peso 6x cada; os demais, peso 1x). */
const SOCIAL = new Set(['Instagram', 'Facebook', 'TikTok']);
const SITE_WEIGHTS = SITES.flatMap((s) => Array(SOCIAL.has(s.name) ? 6 : 1).fill(s));

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]) => a[rnd(0, a.length - 1)];

/* ------------------------------------------------------------------ */
/* Catálogo de prêmios: cada texto é único e plausível (sem combinações absurdas). */
/* ------------------------------------------------------------------ */

const brl = (n: number) => 'R$ ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const cross = (as: string[], bs: string[], f: (a: string, b: string) => string) => as.flatMap((a) => bs.map((b) => f(a, b)));

function buildCatalog(): string[] {
  const out: string[] = [];
  const add = (...xs: string[]) => out.push(...xs);

  const money = [250, 300, 400, 500, 600, 750, 800, 900, 1000, 1200, 1500, 1800, 2000, 2200, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 10000, 11000, 12000, 13000, 15000, 17000, 20000, 22000, 25000, 28000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 85000, 100000];
  const moneyPhr = [
    (v: string) => `${v} no PIX`, (v: string) => `${v} em dinheiro`, (v: string) => `Vale-compras de ${v}`,
    (v: string) => `${v} para sua viagem dos sonhos`, (v: string) => `${v} direto na conta`, (v: string) => `Prêmio de ${v}`,
    (v: string) => `${v} de crédito para compras`, (v: string) => `${v} para gastar como quiser`, (v: string) => `${v} em prêmio surpresa`,
    (v: string) => `${v} na conta em até 24h`,
  ];
  for (const v of money) add(...moneyPhr.map((f) => f(brl(v))));

  // dinheiro por ocasião: mesma faixa de valores, vinculada a uma data/tema do calendário comercial
  const occasions = ['de Natal', 'de Ano Novo', 'do Dia das Mães', 'do Dia dos Pais', 'do Dia dos Namorados', 'da Black Friday', 'de aniversário da marca', 'de Páscoa', 'do Dia das Crianças', 'de Carnaval', 'de volta às aulas', 'de São João', 'do Dia do Consumidor', 'de inverno', 'de verão'];
  for (const v of money) add(...occasions.map((o) => `${brl(v)} em dinheiro — Promoção ${o}`));

  const stores = ['Magazine Luiza', 'Casas Bahia', 'Amazon', 'Mercado Livre', 'Americanas', 'Shopee', 'AliExpress', 'iFood', 'Rappi', 'Netshoes', 'Renner', 'C&A', 'Riachuelo', 'Marisa', 'Carrefour', 'Pão de Açúcar', 'Extra', 'Leroy Merlin', 'Telhanorte', 'Kabum', 'Fast Shop', 'Centauro', 'Decathlon', 'Sephora', 'O Boticário', 'Natura', 'Uber', 'Spotify', 'Netflix', 'Disney+', 'Steam', 'PlayStation Store', 'Google Play', 'App Store', 'Vivara', 'Lojas Americanas', 'Submarino', 'Ponto Frio', 'Drogasil', 'Petz'];
  const giftValues = ['30', '50', '75', '100', '150', '200', '250', '300', '400', '500', '600', '750', '1.000', '1.200', '1.500', '2.000', '2.500', '3.000', '4.000', '5.000', '7.500', '10.000'];
  add(...cross(stores, giftValues, (s, v) => `Gift card ${s} R$ ${v}`));
  // mesma base, com rótulo "promoção <loja>" e valores reduzidos (sorteios menores, mais frequentes)
  const giftValuesSmall = ['15', '20', '25', '35', '40', '60', '80', '90', '120', '180'];
  add(...cross(stores, giftValuesSmall, (s, v) => `Promoção ${s}: Gift card R$ ${v}`));

  const phones = ['iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 14', 'iPhone 13', 'Galaxy S24', 'Galaxy S24+', 'Galaxy S24 Ultra', 'Galaxy A55', 'Galaxy A35', 'Galaxy Z Flip5', 'Galaxy Z Fold5', 'Xiaomi 13T', 'Redmi Note 13 Pro', 'Moto G84', 'Motorola Edge 40', 'Pixel 8'];
  const phoneColors = ['Preto', 'Branco', 'Azul', 'Prata', 'Dourado', 'Verde', 'Roxo'];
  add(...cross(cross(phones, ['128GB', '256GB', '512GB'], (p, s) => `${p} ${s}`), phoneColors, (p, c) => `${p} ${c}`));
  add(...cross(phones, [' + fone sem fio', ' + carregador turbo e capa'], (p, x) => `${p}${x}`));

  const notes = ['MacBook Air M2', 'MacBook Air M3', 'MacBook Pro 14"', 'Dell Inspiron 15', 'Dell XPS 13', 'Lenovo IdeaPad 3', 'Lenovo Legion 5', 'Acer Nitro 5', 'Acer Aspire 5', 'ASUS TUF Gaming F15', 'ASUS Vivobook 15', 'Samsung Galaxy Book3', 'HP Pavilion 15', 'HP Victus 15', 'Positivo Vision'];
  add(...cross(notes, ['', ' + mochila', ' + mouse e headset', ' + monitor 24"'], (n, x) => `${n}${x}`));

  const tvs = ['Samsung', 'LG', 'Sony', 'TCL', 'Philips', 'AOC', 'Panasonic', 'Hisense'];
  add(...cross(tvs, ['32"', '43"', '50"', '55"', '65"', '75"', '85"'], (b, s) => `Smart TV ${b} ${s} 4K`));
  add(...cross(['Samsung', 'LG', 'Sony', 'TCL'], ['55"', '65"', '75"'], (b, s) => `Smart TV ${b} ${s} QLED`));

  const games = ['PlayStation 5', 'PlayStation 5 Slim Digital', 'Xbox Series X', 'Xbox Series S', 'Nintendo Switch OLED', 'Nintendo Switch Lite', 'Steam Deck 512GB', 'Meta Quest 3', 'PlayStation VR2'];
  add(...cross(games, ['', ' + 2 jogos', ' + controle extra'], (g, x) => `${g}${x}`));
  add('Setup gamer completo', 'Cadeira gamer ergonômica', 'Monitor gamer 27" 165Hz', 'Monitor ultrawide 34"', 'Kit teclado e mouse gamer', 'Headset gamer sem fio', 'PC gamer RTX 4060', 'PC gamer RTX 4070', 'Placa de vídeo RTX 4070 Super');

  const eletro = ['Geladeira Brastemp Frost Free 375L', 'Geladeira Electrolux Inverse 480L', 'Geladeira Consul Duplex 340L', 'Geladeira Samsung Side by Side', 'Máquina de lavar Brastemp 12kg', 'Máquina de lavar Electrolux 15kg', 'Lava e seca LG 11kg', 'Lava-louças Brastemp 14 serviços', 'Fogão Atlas 5 bocas', 'Cooktop Fischer 5 bocas', 'Forno elétrico Oster 44L', 'Micro-ondas Panasonic 32L', 'Micro-ondas Electrolux 30L', 'Air Fryer Philips Walita 6,2L', 'Air Fryer Mondial 12L', 'Air Fryer + Cooktop', 'Robô aspirador Xiaomi', 'Robô aspirador Electrolux', 'Ar-condicionado Samsung 12000 BTUs', 'Ar-condicionado LG Dual Inverter 18000 BTUs', 'Cafeteira Nespresso Vertuo', 'Cafeteira Dolce Gusto', 'Batedeira planetária Britânia', 'Purificador de água Electrolux', 'Ventilador Arno 40cm', 'Aspirador de pó Wap', 'Liquidificador Oster', 'Fritadeira elétrica Philco', 'Churrasqueira elétrica', 'Adega climatizada 12 garrafas'];
  add(...eletro, ...eletro.map((e) => `${e} com instalação grátis`), ...eletro.map((e) => `${e} com frete grátis`));

  // combinações marca × linha para ampliar eletros sem perder plausibilidade
  const eletroKinds: [string, string[], string[]][] = [
    ['Geladeira', ['Brastemp', 'Electrolux', 'Consul', 'Samsung', 'LG', 'Panasonic'], ['310L', '340L', '375L', '400L', '450L', '480L', '540L']],
    ['Máquina de lavar', ['Brastemp', 'Electrolux', 'Samsung', 'LG', 'Consul', 'Midea'], ['10kg', '11kg', '12kg', '13kg', '15kg', '17kg']],
    ['Ar-condicionado', ['Samsung', 'LG', 'Midea', 'Electrolux', 'Springer', 'Gree'], ['9000 BTUs', '12000 BTUs', '18000 BTUs', '24000 BTUs']],
  ];
  for (const [kind, brands, sizes] of eletroKinds) add(...cross(brands, sizes, (b, s) => `${kind} ${b} ${s}`));

  add(...cross(['Netflix', 'Amazon Prime Video', 'Disney+', 'HBO Max', 'Spotify Premium', 'YouTube Premium', 'Globoplay', 'Paramount+', 'Deezer', 'Apple Music'], ['3 meses', '6 meses', '1 ano', '2 anos'], (s, t) => `Assinatura ${s} por ${t}`));

  const cars = ['Fiat Mobi', 'Fiat Argo', 'Fiat Cronos', 'Fiat Strada', 'Fiat Toro', 'Fiat Pulse', 'Volkswagen Polo', 'Volkswagen Virtus', 'Volkswagen T-Cross', 'Volkswagen Nivus', 'Volkswagen Saveiro', 'Chevrolet Onix', 'Chevrolet Onix Plus', 'Chevrolet Tracker', 'Chevrolet Montana', 'Hyundai HB20', 'Hyundai Creta', 'Renault Kwid', 'Renault Duster', 'Toyota Yaris', 'Toyota Corolla Cross', 'Honda City', 'Honda HR-V', 'Jeep Renegade', 'Jeep Compass', 'Nissan Kicks', 'Peugeot 208', 'Citroën C3', 'BYD Dolphin', 'Caoa Chery Tiggo 5x'];
  add(...cross(cars, ['0km', '0km com IPVA pago', '0km + R$ 5.000 para documentação', '0km versão topo de linha'], (c, x) => `${c} ${x}`));
  const motos = ['Honda CG 160', 'Honda Biz 125', 'Honda Pop 110i', 'Honda CB 300F', 'Honda XRE 300', 'Honda PCX', 'Yamaha Factor 150', 'Yamaha Fazer 250', 'Yamaha NMax 160', 'Yamaha Lander 250', 'Yamaha MT-03', 'Haojue DK 150', 'Shineray Jet 125', 'Suzuki V-Strom 650', 'Royal Enfield Hunter 350'];
  add(...cross(motos, ['0km', '0km com capacete e kit documentação'], (m, x) => `Moto ${m} ${x}`));
  add('Bicicleta Elétrica', 'Bicicleta Caloi Explorer', 'Bicicleta Specialized Rockhopper', 'Bicicleta Oggi aro 29', 'Bike Trek Marlin 5', 'Scooter elétrica Xiaomi', 'Patinete elétrico Xiaomi Pro 4', 'Triciclo elétrico', 'Kit capacete e acessórios para moto', 'Jet ski Sea-Doo Spark');

  const dest = ['Cancún', 'Punta Cana', 'Orlando', 'Miami', 'Nova York', 'Paris', 'Roma', 'Lisboa', 'Madri', 'Londres', 'Santiago', 'Buenos Aires', 'Bariloche', 'Cartagena', 'Aruba', 'Fernando de Noronha', 'Porto de Galinhas', 'Maceió', 'Jericoacoara', 'Gramado', 'Foz do Iguaçu', 'Bonito', 'Florianópolis', 'Salvador', 'Rio de Janeiro', 'Natal', 'Fortaleza', 'Lençóis Maranhenses', 'Búzios', 'Campos do Jordão', 'Balneário Camboriú', 'Ilhabela', 'Paraty', 'Curitiba', 'Recife', 'Ouro Preto', 'Chapada Diamantina', 'Santa Catarina', 'Maragogi', 'Morro de São Paulo'];
  const destTrips = cross(dest, ['Viagem para {d} para 2 pessoas', 'Pacote {d} com hospedagem', 'Viagem para {d} com passagem aérea', 'Fim de semana em {d}', 'Lua de mel em {d}', 'Viagem em família para {d}'], (d, f) => f.replace('{d}', d));
  add(...cross(destTrips, ['', ' (4 diárias)', ' (7 diárias)', ' (10 diárias)', ' com café da manhã incluso', ' em resort all-inclusive'], (t, x) => `${t}${x}`));
  add('Cruzeiro pelo Caribe', 'Cruzeiro pela Costa Brasileira', 'Cruzeiro pelo Mediterrâneo', 'Cruzeiro pelo litoral do Nordeste', 'Cruzeiro MSC 7 noites');

  add(...cross(['Apple Watch Series 9 41mm', 'Apple Watch Series 9 45mm', 'Apple Watch Ultra 2', 'Galaxy Watch6', 'Garmin Forerunner 265', 'Garmin Venu 3', 'Amazfit GTR 4'], ['', ' + pulseira extra'], (w, x) => `${w}${x}`));
  add('AirPods Pro 2', 'AirPods Max', 'AirPods 3ª geração', 'JBL Charge 5', 'JBL Flip 6', 'JBL PartyBox 310', 'Sony WH-1000XM5', 'Bose QuietComfort 45', 'Galaxy Buds2 Pro', 'Caixa de som Echo Studio', 'Soundbar Samsung 5.1', 'Soundbar LG 3.1');
  add(...cross(['iPad 10ª geração', 'iPad Air', 'iPad Pro 11"', 'Galaxy Tab S9', 'Galaxy Tab S9 FE', 'Galaxy Tab A9+'], ['64GB', '128GB', '256GB'], (t, s) => `${t} ${s}`));
  add('GoPro Hero 12', 'Canon EOS R50 com lente', 'Sony ZV-E10', 'Sony Alpha a6400', 'DJI Mini 4 Pro', 'DJI Osmo Pocket 3', 'Câmera Instax Mini 12', 'Kindle Paperwhite', 'Kindle Scribe', 'Projetor Epson 4K', 'Tablet Wacom Intuos');
  add('Kit Home Office', 'Kit Home Office premium', 'Kit Churrasqueira completo', 'Kit Ferramentas Bosch', 'Kit Cozinha Tramontina', 'Kit Cama, mesa e banho', 'Sofá retrátil 3 lugares', 'Guarda-roupa casal 6 portas', 'Cama box queen', 'Colchão ortopédico king', 'Mesa de jantar 6 lugares', 'Kit sala de estar', 'Cesta de Natal premium', 'Kit Skin Care', 'Kit Cafe da Manhã', 'Smart Lock + câmeras de segurança', 'Kit Fitness em casa', 'Esteira elétrica Movement', 'Bicicleta ergométrica', 'Estação de musculação');
  add('Ingressos para show + hospedagem', 'Ingressos para a final do campeonato', 'Camarote em festival de música', 'Curso de idiomas por 1 ano', 'Graduação com bolsa integral', 'Plano de saúde por 12 meses', 'Assinatura de streaming por 1 ano', 'Mensalidade de academia por 1 ano', 'Day use em resort', 'Jantar para 2 em restaurante premiado');

  // sorteios locais (comuns em redes sociais): valor em dinheiro + cidade do participante
  const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba', 'Salvador', 'Recife', 'Fortaleza', 'Brasília', 'Goiânia', 'Manaus', 'Belém', 'Campinas', 'Santos', 'Sorocaba', 'Ribeirão Preto', 'Uberlândia', 'Joinville', 'Florianópolis', 'Vitória', 'Natal', 'João Pessoa', 'Maceió', 'Aracaju', 'Teresina', 'São Luís', 'Cuiabá', 'Campo Grande', 'Londrina', 'Maringá', 'Caxias do Sul', 'Niterói', 'Juiz de Fora', 'Feira de Santana', 'Blumenau', 'Piracicaba', 'Bauru', 'Anápolis', 'Montes Claros', 'Petrópolis'];
  const localMoney = [100, 150, 200, 250, 300, 400, 500, 600, 750, 1000].map(brl);
  add(...cross(cities, localMoney, (c, v) => `${v} no PIX para seguidores de ${c}`));
  add(...cross(cities, localMoney, (c, v) => `${v} em dinheiro — sorteio especial ${c}`));
  const localGiftValues = ['50', '100', '150', '200'];
  add(...cross(cities, cross(stores, localGiftValues, (s, v) => `${s} R$ ${v}`), (c, sv) => `Gift card ${sv} — promoção ${c}`));

  const seen = new Set<string>();
  return out.filter((t) => !seen.has(t) && seen.add(t));
}

export const CATALOG = buildCatalog();

export const titleOf = (prize: string) => `Sorteio ${prize}`;

/* ------------------------------------------------------------------ */
/* Raffles                                                            */
/* ------------------------------------------------------------------ */

export function makeRaffleData(prize: string, endsAt: Date, durationMs: number) {
  const site = pick(SITE_WEIGHTS);
  return {
    title: titleOf(prize),
    prize,
    site: site.name,
    siteColor: site.color,
    siteEmoji: site.emoji,
    seed: rnd(1, 2_000_000_000),
    baseCount: rnd(1_200, 480_000),
    createdAt: new Date(endsAt.getTime() - durationMs),
    endsAt,
  };
}

/** Escolhe um horário de término que não colida (±20s) com nenhum outro. */
export function freeEndTime(wantMs: number, taken: number[]) {
  let t = wantMs;
  for (let i = 0; i < 200 && taken.some((x) => Math.abs(x - t) < 20_000); i++) t = wantMs + rnd(-90, 90) * 1000 + i * 1000;
  return t;
}

/** Prêmios ainda não usados (ou usados há mais tempo) — nunca repete algo recente. */
export function pickFreePrize(usedRecently: Set<string>, usedAny: Map<string, number>) {
  const fresh = CATALOG.filter((p) => !usedAny.has(p));
  if (fresh.length) return pick(fresh);
  const old = CATALOG.filter((p) => !usedRecently.has(p));
  if (old.length) return pick(old);
  return pick(CATALOG);
}

/* ------------------------------------------------------------------ */
/* Base de usuários: 72.000 identidades distintas, das quais 10.000 são o pool de usuários */
/* ------------------------------------------------------------------ */

const UNIVERSE = FIRST.length * LAST.length * 90; // 72.000
export const POOL_SIZE = 10_000;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** i (0..71999) → identidade única e bem espalhada. 40501 é coprimo de 72000, logo a troca é bijetiva. */
function identity(i: number) {
  const c = (i * 40501 + 12345) % UNIVERSE;
  const first = FIRST[c % FIRST.length];
  const last = LAST[Math.floor(c / FIRST.length) % LAST.length];
  const n = Math.floor(c / (FIRST.length * LAST.length)) + 10;
  return `${first} ${last[0]}.${last.slice(1, 3)}*** #${n}`;
}

export const poolUser = (i: number) => identity(i % POOL_SIZE);

/**
 * Participante da posição `index` do sorteio. Ninguém repete dentro do mesmo sorteio:
 * as primeiras 10.000 posições percorrem todo o pool de usuários, depois o restante da base.
 */
export function participantAt(seed: number, index: number) {
  const r = mulberry32(seed);
  let s1 = 1 + 2 * Math.floor(r() * 5000);
  if (s1 % 5 === 0) s1 += 2;
  let s2 = 1 + Math.floor(r() * 60000);
  while (s2 % 2 === 0 || s2 % 5 === 0 || s2 % 31 === 0) s2++;
  const o1 = Math.floor(r() * POOL_SIZE);
  const o2 = Math.floor(r() * (UNIVERSE - POOL_SIZE));
  const k = ((index % UNIVERSE) + UNIVERSE) % UNIVERSE;
  if (k < POOL_SIZE) return identity((o1 + k * s1) % POOL_SIZE);
  return identity(POOL_SIZE + ((o2 + (k - POOL_SIZE) * s2) % (UNIVERSE - POOL_SIZE)));
}

/** Ganhador sorteado do pool de usuários, nunca repetindo um que já ganhou. */
export function uniqueWinnerName(_seed: number, used: Set<string>) {
  for (let i = 0; i < 2000; i++) {
    const n = poolUser(rnd(0, POOL_SIZE - 1));
    if (!used.has(n)) return n;
  }
  for (let i = 0; i < POOL_SIZE; i++) {
    const n = poolUser(i);
    if (!used.has(n)) return n;
  }
  return poolUser(rnd(0, POOL_SIZE - 1));
}

/* ------------------------------------------------------------------ */
/* Usuário logado dentro das listas                                    */
/* ------------------------------------------------------------------ */

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Nome do usuário no mesmo formato mascarado das outras pessoas ("Breno L.im*** #45"). */
export function maskedUser(fullName: string, userId: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const n = 10 + (hashStr(userId) % 90);
  return `${first} ${last[0].toUpperCase()}.${last.slice(1, 3)}*** #${n}`;
}

/** Posição fixa (por sorteio) em que o usuário aparece na lista. */
export function userIndex(seed: number, userId: string) {
  const r = mulberry32(seed ^ hashStr(userId))();
  return 25 + Math.floor(r * 1975);
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
