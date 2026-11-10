import { z } from "zod";

/*
 * Textos do banner de consentimento (LGPD). Estes são o PADRÃO: o painel (Configurações › Privacidade)
 * pode trocar qualquer campo, e o que ficar em branco volta para cá.
 *
 * PERSONALIZAR: revise os textos com o seu jurídico e com a linguagem do seu público.
 * Regras que a base segue (orientação da ANPD sobre cookies):
 * - dizer em linguagem simples o que é coletado, para quê e com quem é compartilhado;
 * - recusar precisa ser tão fácil quanto aceitar (botões com o mesmo destaque, na primeira tela);
 * - nada de marketing antes do aceite; a pessoa pode mudar de ideia a qualquer momento.
 */

export const consentTextsSchema = z.object({
	accept: z.string().trim().max(40),
	body: z.string().trim().max(600),
	marketingDescription: z.string().trim().max(600),
	marketingTitle: z.string().trim().max(80),
	necessaryDescription: z.string().trim().max(400),
	necessaryTitle: z.string().trim().max(80),
	policyLink: z.string().trim().max(60),
	preferences: z.string().trim().max(40),
	reject: z.string().trim().max(40),
	save: z.string().trim().max(40),
	title: z.string().trim().max(80),
});
export type ConsentTexts = z.infer<typeof consentTextsSchema>;

export const DEFAULT_CONSENT_TEXTS: ConsentTexts = {
	accept: "Aceitar todos",
	body: "Usamos cookies próprios, da Meta (Facebook e Instagram) e do Google para medir de onde vêm as visitas e as compras e melhorar nossos anúncios. Eles só são ativados se você aceitar. Você pode mudar sua escolha a qualquer momento.",
	marketingDescription:
		"Identificador aleatório do visitante, origem da visita (campanha e clique no anúncio), páginas vistas e progresso do vídeo, Pixel da Meta e Google Analytics. Quando você se cadastra ou compra, e-mail, telefone e nome vão à Meta somente embaralhados (hash).",
	marketingTitle: "Marketing e medição",
	necessaryDescription:
		"Guardam só a sua escolha sobre cookies, para não perguntar de novo. Não identificam você e não podem ser desligados.",
	necessaryTitle: "Necessários",
	policyLink: "Política de privacidade",
	preferences: "Preferências",
	reject: "Recusar",
	save: "Salvar escolha",
	title: "Sua privacidade",
};

/** Junta os textos salvos no painel com o padrão (campo vazio ou ausente = padrão). */
export function resolveConsentTexts(saved: unknown): ConsentTexts {
	const parsed = consentTextsSchema.partial().safeParse(saved ?? {});
	const custom = parsed.success ? parsed.data : {};
	const out = { ...DEFAULT_CONSENT_TEXTS };
	for (const key of Object.keys(out) as (keyof ConsentTexts)[]) {
		const value = custom[key];
		if (value) out[key] = value;
	}
	return out;
}
