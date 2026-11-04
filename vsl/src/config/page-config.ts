// Importar SOMENTE em server components: o parse roda no build e o Zod não vai para o navegador.
import { PageConfigSchema } from "./page-config.schema";

/**
 * Tudo que é editável na VSL. Valor inválido quebra o build com a mensagem do Zod.
 * Para trocar o vídeo, a liberação no Vimeo precisa incluir vsl.rastrewin.com (ver README).
 */
export const pageConfig = PageConfigSchema.parse({
	copy: {
		cta: "Quero conhecer a Rastrewin",
		metaDisclaimer:
			"Este site não faz parte do site do Facebook ou da Meta Platforms, Inc. Além disso, este site não é endossado pelo Facebook de forma alguma. FACEBOOK é uma marca registrada da Meta Platforms, Inc.",
		subtitle:
			"Você cadastra seus dados uma única vez. A IA da Rastrewin faz o resto. Assista e entenda como funciona.",
		title: "Nós inscrevemos você em milhares de sorteios.",
	},
	destinationUrl: "https://rastrewin.com",
	posterSrc: "/poster-v2.webp",
	siteUrl: "https://vsl.rastrewin.com",
	unlockAtSeconds: 150,
	vimeoId: "1243006876",
});
