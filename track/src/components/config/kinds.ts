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
	ads: {
		description: "Usadas só para LER os resultados das campanhas (gasto, ROAS, CPA).",
		empty: "Nenhuma conta de anúncio. Adicione para ver ROAS e CPA em Campanhas.",
		externalLabel: "ID da conta de anúncios",
		externalPlaceholder: "act_123456789 ou 123456789",
		help: "Configurações do negócio › Usuários do sistema › Gerar token (permissão ads_read) e atribua a conta ao usuário.",
		noun: "conta",
		secretLabel: "Token de acesso com permissão ads_read",
		title: "Contas de anúncio",
	},
	ga4: {
		description:
			"Recebem a compra do webhook pelo Measurement Protocol. A gtag do site usa os mesmos Measurement IDs.",
		empty: "Nenhuma propriedade GA4. Adicione para enviar as compras ao Google Analytics.",
		externalLabel: "Measurement ID",
		externalPlaceholder: "G-XXXXXXXXXX",
		help: "GA4 › Administrador › Fluxos de dados › seu fluxo da Web › Chaves secretas da API do Measurement Protocol.",
		noun: "propriedade",
		secretLabel: "API secret do Measurement Protocol",
		title: "Propriedades GA4",
	},
	pixel: {
		description:
			"Cada evento vai para TODOS os pixels ativos, no navegador e na Conversions API, com o mesmo event_id.",
		empty: "Nenhum pixel. Adicione para enviar eventos à Meta.",
		externalLabel: "ID do pixel (conjunto de dados)",
		externalPlaceholder: "123456789012345",
		help: "Gerenciador de Eventos › seu pixel › Configurações › Conversions API › Gerar token de acesso.",
		noun: "pixel",
		secretLabel: "Token da Conversions API",
		title: "Pixels Meta",
	},
};
