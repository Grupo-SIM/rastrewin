export type SiteInfo = { name: string; color: string; logo?: string; full?: boolean };

/** Sites reais têm logo (em /public/logos); os demais são fictícios e usam a inicial colorida. */
export const SITES: SiteInfo[] = [
  { name: 'Portal da Promo', color: '#e11d48', logo: '/logos/portaldapromo.ico' },
  { name: 'Cidade de Prêmios', color: '#16a34a', logo: '/logos/cidadedepremios.png' },
  { name: 'Giro Premiado', color: '#f59e0b', logo: '/logos/giropremiadooficial.png' },
  { name: 'Clube dos Premiados', color: '#7c3aed', logo: '/logos/clubedospremiados.png' },
  { name: 'Palpito', color: '#0ea5e9', logo: '/logos/palpito.png' },
  { name: 'QualiBest', color: '#14b8a6', logo: '/logos/qualibest.png' },
  { name: 'VocêOpina', color: '#6366f1', logo: '/logos/voceopina.png' },
  { name: 'Toluna', color: '#2563eb', logo: '/logos/toluna.png' },
  { name: 'LifePoints', color: '#84cc16', logo: '/logos/lifepoints.png' },
  { name: 'Swagbucks', color: '#0284c7', logo: '/logos/swagbucks.png' },
  { name: 'MOBROG', color: '#ea580c', logo: '/logos/mobrog.png' },
  { name: 'PrizeRebel', color: '#ff5a36', logo: '/logos/prizerebel.png' },
  // redes sociais: sorteios de perfis/marcas mapeados nessas redes (concentram boa parte do catálogo)
  { name: 'Instagram', color: '#E1306C', logo: '/logos/instagram.svg', full: true },
  { name: 'Facebook', color: '#1877F2', logo: '/logos/facebook.svg', full: true },
  { name: 'TikTok', color: '#000000', logo: '/logos/tiktok.svg', full: true },
];

export const siteInfo = (name: string, fallbackColor = '#6366f1'): SiteInfo =>
  SITES.find((s) => s.name === name) ?? { name, color: fallbackColor };
