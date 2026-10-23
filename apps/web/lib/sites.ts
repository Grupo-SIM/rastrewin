export type SiteInfo = { name: string; color: string; logo?: string; full?: boolean };

/** Sites reais têm logo (em /public/logos); os demais são fictícios e usam a inicial colorida. */
export const SITES: SiteInfo[] = [
  { name: 'Cidade de Prêmios', color: '#16a34a', logo: '/logos/cidadedepremios.png' },
  { name: 'Giro Premiado', color: '#f59e0b', logo: '/logos/giropremiadooficial.png' },
  { name: 'Clube dos Premiados', color: '#7c3aed', logo: '/logos/clubedospremiados.png' },
  { name: 'QualiBest', color: '#14b8a6', logo: '/logos/qualibest.png' },
  { name: 'Swagbucks', color: '#0284c7', logo: '/logos/swagbucks.png' },
  // redes sociais: sorteios de perfis/marcas mapeados nessas redes (concentram boa parte do catálogo)
  { name: 'Instagram', color: '#E1306C', logo: '/logos/instagram.svg', full: true },
  { name: 'Facebook', color: '#1877F2', logo: '/logos/facebook.svg', full: true },
  { name: 'TikTok', color: '#000000', logo: '/logos/tiktok.svg', full: true },
];

export const siteInfo = (name: string, fallbackColor = '#6366f1'): SiteInfo =>
  SITES.find((s) => s.name === name) ?? { name, color: fallbackColor };
