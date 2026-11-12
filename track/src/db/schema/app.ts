import { sql } from "drizzle-orm";
import {
	bigserial,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { bytea, clientColumns, connectionTestColumns, geoColumns, timestamps, utmColumns } from "./columns";

/*
 * REGRAS (aplicadas na migration de segurança via app_private.secure_table):
 * - RLS ligada e FORÇADA em todas as tabelas.
 * - app_service (servidor) lê e escreve; app_reader (painel) só lê, e só com sessão válida.
 * - Colunas terminadas em `_enc` (segredos cifrados) NÃO são legíveis por app_reader.
 */

// ---------------------------------------------------------------- configuração

/** Linha única (id = 1). */
export const settings = pgTable(
	"settings",
	{
		/** Origens (sites) autorizadas a chamar /api/identify e /api/event (CORS). */
		allowedOrigins: text("allowed_origins")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** Domínios de checkout cujos links recebem o trck_user_id. */
		checkoutDomains: text("checkout_domains")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/**
		 * Textos do banner de consentimento (LGPD). Nulo = textos padrão do código
		 * (src/lib/privacy/consent-texts.ts). Campos ausentes também caem no padrão.
		 */
		consentTexts: jsonb("consent_texts"),
		/** Versão do texto do consentimento. Mudar pede o consentimento de novo a todos os visitantes. */
		consentVersion: text("consent_version").notNull().default("1"),
		currency: text("currency").notNull().default("BRL"),
		/** Modo debug do GA4: valida no /debug/mp/collect e envia com debug_mode (aparece no DebugView). */
		ga4Debug: boolean("ga4_debug").notNull().default(false),
		id: smallint("id").primaryKey().default(1),
		/** Link da política de privacidade mostrado no banner. */
		privacyPolicyUrl: text("privacy_policy_url"),
		testEventCode: text("test_event_code"),
		/** Fuso horário do painel (IANA). Use o MESMO da conta de anúncios para os relatórios por dia baterem. */
		timezone: text("timezone").notNull().default("America/Sao_Paulo"),
		/** Segredo compartilhado com a plataforma de venda (assinatura HMAC do webhook). */
		webhookTokenEnc: bytea("webhook_token_enc"),
		webhookTokenHint: text("webhook_token_hint"),
		...timestamps(),
	},
	t => [
		check("settings_singleton", sql`${t.id} = 1`),
		check("settings_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
	],
);

export const ga4Accounts = pgTable(
	"ga4_accounts",
	{
		active: boolean("active").notNull().default(true),
		apiSecretEnc: bytea("api_secret_enc").notNull(),
		apiSecretHint: text("api_secret_hint").notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		label: text("label").notNull(),
		measurementId: text("measurement_id").notNull().unique(),
		...connectionTestColumns(),
		...timestamps(),
	},
	t => [check("ga4_measurement_id_format", sql`${t.measurementId} ~ '^G-[A-Z0-9]{4,20}$'`)],
);

export const metaPixels = pgTable(
	"meta_pixels",
	{
		active: boolean("active").notNull().default(true),
		capiTokenEnc: bytea("capi_token_enc").notNull(),
		capiTokenHint: text("capi_token_hint").notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		label: text("label").notNull(),
		pixelId: text("pixel_id").notNull().unique(),
		...connectionTestColumns(),
		...timestamps(),
	},
	t => [check("meta_pixel_id_format", sql`${t.pixelId} ~ '^[0-9]{5,25}$'`)],
);

export const metaAdAccounts = pgTable(
	"meta_ad_accounts",
	{
		active: boolean("active").notNull().default(true),
		/** Só os dígitos (sem o prefixo act_). */
		adAccountId: text("ad_account_id").notNull().unique(),
		adsTokenEnc: bytea("ads_token_enc").notNull(),
		adsTokenHint: text("ads_token_hint").notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		label: text("label").notNull(),
		...connectionTestColumns(),
		...timestamps(),
	},
	t => [check("meta_ad_account_id_format", sql`${t.adAccountId} ~ '^[0-9]{5,25}$'`)],
);

// ---------------------------------------------------------------- captura

export const visitors = pgTable(
	"visitors",
	{
		/** Quando a escolha de marketing abaixo foi registrada. */
		consentAt: timestamp("consent_at", { withTimezone: true }),
		/**
		 * Consentimento de marketing e medição (banner do t.js). Nulo = visitante de antes do banner.
		 * Só com true os eventos e a compra vão à Meta e ao GA4.
		 */
		consentMarketing: boolean("consent_marketing"),
		email: text("email"),
		/** SHA-256 (normalizado) — formato exigido pela Meta CAPI. */
		emHash: text("em_hash"),
		fbc: text("fbc"),
		fbp: text("fbp"),
		fnHash: text("fn_hash"),
		gaClientId: text("ga_client_id"),
		gaSessionId: text("ga_session_id"),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		lnHash: text("ln_hash"),
		phHash: text("ph_hash"),
		trckUserId: text("trck_user_id").notNull().unique(),
		...utmColumns(),
		landingUrl: text("landing_url"),
		referrer: text("referrer"),
		...clientColumns(),
		...geoColumns(),
		pixelId: text("pixel_id"),
		...timestamps(),
	},
	t => [
		index("visitors_em_hash_idx").on(t.emHash),
		index("visitors_ph_hash_idx").on(t.phHash),
		index("visitors_created_at_idx").on(t.createdAt),
		// Retenção (LGPD): visitante sem atividade há 13 meses é apagado.
		index("visitors_updated_at_idx").on(t.updatedAt),
	],
);

export const eventsLog = pgTable(
	"events_log",
	{
		currency: text("currency"),
		/** Mesmo event_id do Pixel (deduplicação). */
		eventId: text("event_id").notNull().unique(),
		eventName: text("event_name").notNull(),
		eventSourceUrl: text("event_source_url"),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		trckUserId: text("trck_user_id").notNull(),
		value: numeric("value", { precision: 14, scale: 2 }),
		...utmColumns(),
		payloadGa4: jsonb("payload_ga4"),
		/** Campos pesados — zerados pela retenção após 14 dias (a linha fica). */
		payloadMeta: jsonb("payload_meta"),
		responseGa4: jsonb("response_ga4"),
		responseMeta: jsonb("response_meta"),
		...clientColumns(),
		...geoColumns(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	t => [
		index("events_log_trck_user_id_idx").on(t.trckUserId),
		index("events_log_event_name_idx").on(t.eventName),
		index("events_log_created_at_idx").on(t.createdAt),
		index("events_log_event_name_created_at_idx").on(t.eventName, t.createdAt),
		// Jornada do visitante: todos os eventos de uma pessoa, em ordem.
		index("events_log_trck_user_id_created_at_idx").on(t.trckUserId, t.createdAt),
		// Retenção (LGPD): só linhas que ainda têm IP ou navegador.
		index("events_log_client_retention_idx")
			.on(t.createdAt)
			.where(sql`${t.ip} is not null or ${t.userAgent} is not null`),
		// Retenção: só linhas que ainda têm payload (o job diário não relê o que já limpou).
		index("events_log_retention_idx")
			.on(t.createdAt)
			.where(
				sql`${t.payloadMeta} is not null or ${t.responseMeta} is not null or ${t.payloadGa4} is not null or ${t.responseGa4} is not null`,
			),
	],
);

// ---------------------------------------------------------------- vídeos

/**
 * Um play de vídeo (resumo, uma linha por play): até onde a pessoa chegou e quanto assistiu de fato.
 * Vem do comando trck('video') do site, por /api/video. NUNCA vai à Meta nem ao GA4.
 * Fora da limpeza diária (é pequeno: uma linha por play, sem payloads).
 */
export const videoViews = pgTable(
	"video_views",
	{
		completed: boolean("completed").notNull().default(false),
		/** Segundo em que o site libera o botão (CTA), se ele informar. */
		ctaS: integer("cta_s"),
		/** Segundos (arredondados). */
		durationS: integer("duration_s").notNull().default(0),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		/** Ponto mais adiante a que a pessoa chegou. */
		maxPositionS: integer("max_position_s").notNull().default(0),
		pageUrl: text("page_url"),
		trckUserId: text("trck_user_id").notNull(),
		/** "<provedor>:<id>", ex.: "vimeo:1243006876". */
		videoId: text("video_id").notNull(),
		videoTitle: text("video_title"),
		/** Gerado pelo t.js: um por vídeo a cada carregamento da página. */
		viewId: text("view_id").notNull().unique(),
		/** Segundos realmente assistidos em reprodução normal (pulos e repetições não contam). */
		watchedS: integer("watched_s").notNull().default(0),
		...utmColumns(),
		...geoColumns(),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	t => [
		index("video_views_video_started_idx").on(t.videoId, t.startedAt),
		index("video_views_started_at_idx").on(t.startedAt),
		index("video_views_trck_user_id_idx").on(t.trckUserId),
		check(
			"video_views_seconds_check",
			sql`${t.durationS} >= 0 and ${t.maxPositionS} >= 0 and ${t.watchedS} >= 0 and (${t.ctaS} is null or ${t.ctaS} >= 0)`,
		),
	],
);

// ---------------------------------------------------------------- vendas

export const purchases = pgTable(
	"purchases",
	{
		currency: text("currency").notNull(),
		email: text("email"),
		emHash: text("em_hash"),
		fnHash: text("fn_hash"),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		items: jsonb("items"),
		lnHash: text("ln_hash"),
		/** Visitante ligado à venda tinha aceitado marketing (foto no momento da venda). Sem true, não vai à Meta/GA4. */
		marketingConsent: boolean("marketing_consent"),
		netValue: numeric("net_value", { precision: 14, scale: 2 }),
		paymentMethod: text("payment_method"),
		phHash: text("ph_hash"),
		product: text("product"),
		status: text("status").notNull(),
		transactionId: text("transaction_id").notNull().unique(),
		trckUserId: text("trck_user_id"),
		value: numeric("value", { precision: 14, scale: 2 }).notNull(),
		...utmColumns(),
		fbc: text("fbc"),
		fbclid: text("fbclid"),
		fbp: text("fbp"),
		src: text("src"),
		...geoColumns(),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		ga4Attempts: integer("ga4_attempts").notNull().default(0),
		ga4SentAt: timestamp("ga4_sent_at", { withTimezone: true }),
		gaClientId: text("ga_client_id"),
		gaSessionId: text("ga_session_id"),
		/** Renovação/recompra de quem já tinha pago: fica no Faturamento, mas não vai à Meta nem ao GA4. */
		isRenewal: boolean("is_renewal").notNull().default(false),
		lastDeliveryError: text("last_delivery_error"),
		/** Vinculação ao visitante: { found, by: 'trck_user_id' | 'email' | 'phone' | null, reason } */
		match: jsonb("match"),
		/** Envio: tentativas e último erro (o reenvio automático para em 5 tentativas). */
		metaAttempts: integer("meta_attempts").notNull().default(0),
		metaEventId: text("meta_event_id"),
		metaSentAt: timestamp("meta_sent_at", { withTimezone: true }),
		/** Quando a venda aconteceu (occurredAt do evento de aprovação). */
		occurredAt: timestamp("occurred_at", { withTimezone: true }),
		payloadGa4: jsonb("payload_ga4"),
		payloadMeta: jsonb("payload_meta"),
		refundedAt: timestamp("refunded_at", { withTimezone: true }),
		refundResponseGa4: jsonb("refund_response_ga4"),
		/** refund enviado ao GA4 (reembolso/chargeback). */
		refundSentAt: timestamp("refund_sent_at", { withTimezone: true }),
		responseGa4: jsonb("response_ga4"),
		responseMeta: jsonb("response_meta"),
		/** Último payload bruto do webhook (auditoria). */
		webhookRaw: jsonb("webhook_raw"),
		...timestamps(),
	},
	t => [
		index("purchases_trck_user_id_idx").on(t.trckUserId),
		index("purchases_status_idx").on(t.status),
		index("purchases_created_at_idx").on(t.createdAt),
		index("purchases_utm_campaign_idx").on(t.utmCampaign),
	],
);

// ---------------------------------------------------------------- privacidade (LGPD)

/**
 * Registro de cada escolha feita no banner (prova do consentimento, LGPD art. 8º).
 * Sem IP nem navegador: só o id aleatório da escolha, o visitante (se aceitou), a versão do texto e onde.
 */
export const consentRecords = pgTable(
	"consent_records",
	{
		/** accept_all | reject_all | custom | revoke */
		action: text("action").notNull(),
		/** Id aleatório gerado pelo t.js e guardado no cookie _trck_consent. */
		consentId: text("consent_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		marketing: boolean("marketing").notNull(),
		/** Site (origem) onde a escolha foi feita. */
		origin: text("origin"),
		/** Página, sem query nem #. */
		pagePath: text("page_path"),
		/** Só quando a pessoa aceitou (na recusa não existe visitante). */
		trckUserId: text("trck_user_id"),
		version: text("version").notNull(),
	},
	t => [
		index("consent_records_consent_id_idx").on(t.consentId),
		index("consent_records_trck_user_id_idx").on(t.trckUserId),
		index("consent_records_created_at_idx").on(t.createdAt),
		check(
			"consent_records_action_check",
			sql`${t.action} in ('accept_all', 'reject_all', 'custom', 'revoke')`,
		),
	],
);

/**
 * Exclusões pedidas pelo titular (LGPD art. 18, VI), via backend do rastrewin (rota assinada).
 * Guarda só os HASHES do email/telefone, por 30 dias, para honrar a exclusão: venda da mesma pessoa
 * que ainda estava a caminho chega anonimizada. Depois a retenção apaga os hashes (ficam data e contagens). ga_client_ids: o que ainda precisa ser apagado à mão no GA4 (sem API aqui);
 * zerado quando alguém marca "Concluído no GA4" no painel.
 */
export const privacyErasures = pgTable(
	"privacy_erasures",
	{
		/** Quantas linhas foram apagadas/anonimizadas em cada tabela. */
		counts: jsonb("counts").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		emHash: text("em_hash"),
		gaClientIds: text("ga_client_ids")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** Quando os client_ids foram apagados no GA4 (manual). */
		gaDoneAt: timestamp("ga_done_at", { withTimezone: true }),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		phHash: text("ph_hash"),
	},
	t => [
		index("privacy_erasures_em_hash_idx").on(t.emHash),
		index("privacy_erasures_ph_hash_idx").on(t.phHash),
	],
);

/** Todo evento recebido no webhook (idempotência + auditoria). */
export const webhookEvents = pgTable(
	"webhook_events",
	{
		error: text("error"),
		/** eventId enviado pela plataforma (único). */
		eventId: text("event_id").notNull().unique(),
		eventType: text("event_type").notNull(),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		orderId: text("order_id"),
		payload: jsonb("payload").notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		provider: text("provider").notNull().default("simintpay"),
		receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
		signatureValid: boolean("signature_valid").notNull(),
	},
	t => [
		index("webhook_events_order_id_idx").on(t.orderId),
		index("webhook_events_received_at_idx").on(t.receivedAt),
	],
);

// ---------------------------------------------------------------- Meta Ads

export const metaInsightsCache = pgTable(
	"meta_insights_cache",
	{
		adAccountId: text("ad_account_id").notNull(),
		cacheKey: text("cache_key").notNull().unique(),
		data: jsonb("data").notNull(),
		fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		level: text("level").notNull(),
		since: date("since"),
		until: date("until"),
		/** Header X-Business-Use-Case-Usage da última chamada. */
		usage: jsonb("usage"),
	},
	t => [index("meta_insights_cache_account_fetched_idx").on(t.adAccountId, t.fetchedAt)],
);

// ---------------------------------------------------------------- manutenção

/** Execuções da limpeza diária (app → app_private.run_retention, como app_service). */
export const maintenanceRuns = pgTable(
	"maintenance_runs",
	{
		/** Contagens das etapas de retenção LGPD (IPs zerados, visitantes apagados, vendas anonimizadas...). */
		details: jsonb("details"),
		error: text("error"),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		id: bigserial("id", { mode: "number" }).primaryKey(),
		job: text("job").notNull(),
		rowsCache: integer("rows_cache").notNull().default(0),
		rowsPayloads: integer("rows_payloads").notNull().default(0),
		rowsSessions: integer("rows_sessions").notNull().default(0),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		/** running | ok | erro */
		status: text("status").notNull().default("running"),
	},
	t => [
		index("maintenance_runs_started_idx").on(t.startedAt),
		check("maintenance_runs_status", sql`${t.status} in ('running', 'ok', 'erro')`),
	],
);
