import type { AccountKind } from "@/lib/config/validation";

/** Textos de cada tipo de conta (seguro para o navegador: não tem segredos). */
export const KIND_META: Record<
  AccountKind,
  {
    title: string;
    description: string;
    noun: string;
    externalLabel: string;
    externalPlaceholder: string;
    secretLabel: string;
    help: string;
    empty: string;
  }
> = {
  ga4: {
    title: "Propriedades GA4",
    description: "Recebem a compra do webhook pelo Measurement Protocol. A gtag do site usa os mesmos Measurement IDs.",
    noun: "propriedade",
    externalLabel: "Measurement ID",
    externalPlaceholder: "G-XXXXXXXXXX",
    secretLabel: "API secret do Measurement Protocol",
    help: "GA4 › Administrador › Fluxos de dados › seu fluxo da Web › Chaves secretas da API do Measurement Protocol.",
    empty: "Nenhuma propriedade GA4. Adicione para enviar as compras ao Google Analytics.",
  },
  pixel: {
    title: "Pixels Meta",
    description: "Cada evento vai para TODOS os pixels ativos, no navegador e na Conversions API, com o mesmo event_id.",
    noun: "pixel",
    externalLabel: "ID do pixel (conjunto de dados)",
    externalPlaceholder: "123456789012345",
    secretLabel: "Token da Conversions API",
    help: "Gerenciador de Eventos › seu pixel › Configurações › Conversions API › Gerar token de acesso.",
    empty: "Nenhum pixel. Adicione para enviar eventos à Meta.",
  },
  ads: {
    title: "Contas de anúncio",
    description: "Usadas só para LER os resultados das campanhas (gasto, ROAS, CPA).",
    noun: "conta",
    externalLabel: "ID da conta de anúncios",
    externalPlaceholder: "act_123456789 ou 123456789",
    secretLabel: "Token de acesso com permissão ads_read",
    help: "Configurações do negócio › Usuários do sistema › Gerar token (permissão ads_read) e atribua a conta ao usuário.",
    empty: "Nenhuma conta de anúncio. Adicione para ver ROAS e CPA em Campanhas.",
  },
};
