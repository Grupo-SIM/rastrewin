export interface SiteInfo {
	name: string;
	color: string;
	logo?: string;
	full?: boolean;
}

/** Sites reais têm logo (em /public/logos); os demais são fictícios e usam a inicial colorida. */
export const SITES: SiteInfo[] = [
	{ color: "#16a34a", logo: "/logos/cidadedepremios.png", name: "Cidade de Prêmios" },
	{ color: "#f59e0b", logo: "/logos/giropremiadooficial.png", name: "Giro Premiado" },
	{ color: "#7c3aed", logo: "/logos/clubedospremiados.png", name: "Clube dos Premiados" },
	{ color: "#14b8a6", logo: "/logos/qualibest.png", name: "QualiBest" },
	{ color: "#0284c7", logo: "/logos/swagbucks.png", name: "Swagbucks" },
	// redes sociais: sorteios de perfis/marcas mapeados nessas redes (concentram boa parte do catálogo)
	{ color: "#E1306C", full: true, logo: "/logos/instagram.svg", name: "Instagram" },
	{ color: "#1877F2", full: true, logo: "/logos/facebook.svg", name: "Facebook" },
	{ color: "#000000", full: true, logo: "/logos/tiktok.svg", name: "TikTok" },
];

export const siteInfo = (name: string, fallbackColor = "#6366f1"): SiteInfo =>
	SITES.find(s => s.name === name) ?? { color: fallbackColor, name };
