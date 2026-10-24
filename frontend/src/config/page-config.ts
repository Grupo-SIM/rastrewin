// Importar SOMENTE em server components: o parse roda no build e o Zod não vai para o navegador.
import { PageConfigSchema } from "./page-config.schema";

/**
 * Tudo que é editável na VSL. Valor inválido quebra o build com a mensagem do Zod.
 * Provisórios: youtubeId, unlockAtSeconds, posterSrc e copy.cta.
 */
export const pageConfig = PageConfigSchema.parse({
  siteUrl: "https://vsl.rastrewin.com",
  // TEMPORÁRIO (testes): Short vertical público do canal oficial do Google e liberação em 5s.
  // Trocar pelo ID do vídeo real da VSL e pelo segundo definitivo do botão.
  youtubeId: "yI5C7LqBVEM",
  unlockAtSeconds: 5,
  destinationUrl: "https://rastrewin.com",
  posterSrc: "/poster.jpg",
  copy: {
    title: "Nós inscrevemos você em milhares de sorteios.",
    subtitle:
      "Você cadastra seus dados uma única vez. A IA da Rastrewin faz o resto. Assista e entenda como funciona.",
    cta: "Quero conhecer a Rastrewin",
    metaDisclaimer:
      "Este site não faz parte do site do Facebook ou da Meta Platforms, Inc. Além disso, este site não é endossado pelo Facebook de forma alguma. FACEBOOK é uma marca registrada da Meta Platforms, Inc.",
  },
});
