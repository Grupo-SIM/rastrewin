import { z } from "zod";

/* Validação das requisições PÚBLICAS de captura. Tudo opcional é limitado em tamanho. */

export const TRCK_ID = /^[A-Za-z0-9_-]{8,64}$/;
const str = (max: number) => z.string().trim().max(max);
const optStr = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform(v => (v ? v : null));

const utm = {
	utm_campaign: optStr(300),
	utm_content: optStr(300),
	utm_medium: optStr(200),
	utm_source: optStr(200),
	utm_term: optStr(300),
};

/** fbp/fbc no formato fb.<n>.<timestamp>.<valor> */
const fbCookie = optStr(500).refine(
	v => v === null || /^fb\.\d\.\d{10,13}\.[\w.-]+$/.test(v),
	"formato inválido",
);

const userData = {
	email: optStr(254),
	first_name: optStr(100),
	last_name: optStr(100),
	phone: optStr(40),
};

const url = optStr(2048).refine(v => v === null || /^https?:\/\//i.test(v), "URL inválida");

/** O t.js avisa quando o navegador é controlado por programa (navigator.webdriver): é robô. */
const webdriver = { wd: z.boolean().optional() };

/**
 * Versão do consentimento de marketing aceita pela pessoa (LGPD). O t.js só manda identify, event e
 * video depois do aceite e sempre com este campo; sem ele (t.js antigo em cache) o servidor ignora.
 */
const CONSENT_VERSION = z.string().trim().min(1).max(20);
const consent = { consent: CONSENT_VERSION.optional() };

/** POST /api/consent — escolha feita no banner. */
export const consentSchema = z
	.object({
		action: z.enum(["accept_all", "reject_all", "custom", "revoke"]),
		consent_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
		marketing: z.boolean(),
		page_url: url,
		trck_user_id: z.string().regex(TRCK_ID).optional().nullable(),
		version: CONSENT_VERSION,
		...webdriver,
	})
	.refine(
		d =>
			(d.action !== "accept_all" || d.marketing) &&
			(d.action !== "reject_all" && d.action !== "revoke" ? true : !d.marketing),
		"escolha incoerente",
	)
	// Na recusa não existe visitante: o id do visitante só vai junto quando a pessoa aceita ou revoga.
	.refine(d => d.marketing || d.action === "revoke" || !d.trck_user_id, "recusa não leva visitante");
export type ConsentInput = z.infer<typeof consentSchema>;

export const identifySchema = z.object({
	fbc: fbCookie,
	fbp: fbCookie,
	ga_client_id: optStr(100).refine(v => v === null || /^\d+\.\d+$/.test(v), "formato inválido"),
	ga_session_id: optStr(40).refine(v => v === null || /^\d+$/.test(v), "formato inválido"),
	landing_url: url,
	pixel_id: optStr(25).refine(v => v === null || /^\d+$/.test(v), "formato inválido"),
	referrer: url,
	trck_user_id: z.string().regex(TRCK_ID).optional().nullable(),
	...utm,
	...userData,
	...webdriver,
	...consent,
});
export type IdentifyInput = z.infer<typeof identifySchema>;

export const eventSchema = z.object({
	custom_data: z
		.object({
			content_ids: z.array(str(100)).max(50).optional(),
			content_name: str(300).optional(),
			content_type: z.enum(["product", "product_group"]).optional(),
			currency: z
				.string()
				.regex(/^[A-Za-z]{3}$/)
				.optional(),
			num_items: z.number().int().nonnegative().max(10_000).optional(),
			value: z.number().finite().nonnegative().max(1e9).optional(),
		})
		.strict()
		.optional(),
	event_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
	event_name: z
		.string()
		.regex(/^[A-Za-z][A-Za-z0-9_]{1,39}$/, "nome de evento inválido")
		.refine(v => v.toLowerCase() !== "purchase", "Purchase só vem do webhook de vendas"),
	event_source_url: url,
	fbc: fbCookie,
	fbp: fbCookie,
	ga_client_id: optStr(100).refine(v => v === null || /^\d+\.\d+$/.test(v), "formato inválido"),
	ga_session_id: optStr(40).refine(v => v === null || /^\d+$/.test(v), "formato inválido"),
	trck_user_id: z.string().regex(TRCK_ID),
	user_data: z.object(userData).optional(),
	// Mesmas UTMs do identify: o evento pode chegar antes dele (os dois saem juntos no PageView).
	...utm,
	...webdriver,
	...consent,
});
export type EventInput = z.infer<typeof eventSchema>;

/** Segundos de vídeo: até 6 h (o t.js já arredonda e limita). */
const videoSeconds = z.number().finite().nonnegative().max(21_600);

/** POST /api/video — progresso de um play (comando trck('video') do site). */
export const videoSchema = z.object({
	/** Segundo em que o site libera o botão (CTA). Opcional. */
	cta: videoSeconds.optional(),
	duration: videoSeconds,
	ended: z.boolean().optional().default(false),
	page_url: url,
	position: videoSeconds,
	title: optStr(300),
	trck_user_id: z.string().regex(TRCK_ID),
	video_id: z.string().regex(/^[a-z]{2,20}:[A-Za-z0-9_-]{1,64}$/, "id de vídeo inválido"),
	view_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
	watched: videoSeconds,
	...webdriver,
	...consent,
});
export type VideoInput = z.infer<typeof videoSchema>;
