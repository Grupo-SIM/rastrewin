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
import {
  bytea,
  clientColumns,
  connectionTestColumns,
  geoColumns,
  timestamps,
  utmColumns,
} from "./columns";

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
    id: smallint("id").primaryKey().default(1),
    /** Segredo compartilhado com a plataforma de venda (assinatura HMAC do webhook). */
    webhookTokenEnc: bytea("webhook_token_enc"),
    webhookTokenHint: text("webhook_token_hint"),
    currency: text("currency").notNull().default("BRL"),
    testEventCode: text("test_event_code"),
    /** Origens (sites) autorizadas a chamar /api/identify e /api/event (CORS). */
    allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
    /** Domínios de checkout cujos links recebem o trck_user_id. */
    checkoutDomains: text("checkout_domains").array().notNull().default(sql`'{}'::text[]`),
    /** Modo debug do GA4: valida no /debug/mp/collect e envia com debug_mode (aparece no DebugView). */
    ga4Debug: boolean("ga4_debug").notNull().default(false),
    /** Fuso horário do painel (IANA). Use o MESMO da conta de anúncios para os relatórios por dia baterem. */
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    ...timestamps(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const ga4Accounts = pgTable(
  "ga4_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    measurementId: text("measurement_id").notNull().unique(),
    apiSecretEnc: bytea("api_secret_enc").notNull(),
    apiSecretHint: text("api_secret_hint").notNull(),
    active: boolean("active").notNull().default(true),
    ...connectionTestColumns(),
    ...timestamps(),
  },
  (t) => [check("ga4_measurement_id_format", sql`${t.measurementId} ~ '^G-[A-Z0-9]{4,20}$'`)],
);

export const metaPixels = pgTable(
  "meta_pixels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    pixelId: text("pixel_id").notNull().unique(),
    capiTokenEnc: bytea("capi_token_enc").notNull(),
    capiTokenHint: text("capi_token_hint").notNull(),
    active: boolean("active").notNull().default(true),
    ...connectionTestColumns(),
    ...timestamps(),
  },
  (t) => [check("meta_pixel_id_format", sql`${t.pixelId} ~ '^[0-9]{5,25}$'`)],
);

export const metaAdAccounts = pgTable(
  "meta_ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    /** Só os dígitos (sem o prefixo act_). */
    adAccountId: text("ad_account_id").notNull().unique(),
    adsTokenEnc: bytea("ads_token_enc").notNull(),
    adsTokenHint: text("ads_token_hint").notNull(),
    active: boolean("active").notNull().default(true),
    ...connectionTestColumns(),
    ...timestamps(),
  },
  (t) => [check("meta_ad_account_id_format", sql`${t.adAccountId} ~ '^[0-9]{5,25}$'`)],
);

// ---------------------------------------------------------------- captura

export const visitors = pgTable(
  "visitors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    trckUserId: text("trck_user_id").notNull().unique(),
    email: text("email"),
    /** SHA-256 (normalizado) — formato exigido pela Meta CAPI. */
    emHash: text("em_hash"),
    phHash: text("ph_hash"),
    fnHash: text("fn_hash"),
    lnHash: text("ln_hash"),
    fbp: text("fbp"),
    fbc: text("fbc"),
    gaClientId: text("ga_client_id"),
    gaSessionId: text("ga_session_id"),
    ...utmColumns(),
    referrer: text("referrer"),
    landingUrl: text("landing_url"),
    ...clientColumns(),
    ...geoColumns(),
    pixelId: text("pixel_id"),
    ...timestamps(),
  },
  (t) => [
    index("visitors_em_hash_idx").on(t.emHash),
    index("visitors_ph_hash_idx").on(t.phHash),
    index("visitors_created_at_idx").on(t.createdAt),
  ],
);

export const eventsLog = pgTable(
  "events_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    trckUserId: text("trck_user_id").notNull(),
    eventName: text("event_name").notNull(),
    /** Mesmo event_id do Pixel (deduplicação). */
    eventId: text("event_id").notNull().unique(),
    eventSourceUrl: text("event_source_url"),
    value: numeric("value", { precision: 14, scale: 2 }),
    currency: text("currency"),
    ...utmColumns(),
    /** Campos pesados — zerados pela retenção após 14 dias (a linha fica). */
    payloadMeta: jsonb("payload_meta"),
    responseMeta: jsonb("response_meta"),
    payloadGa4: jsonb("payload_ga4"),
    responseGa4: jsonb("response_ga4"),
    ...clientColumns(),
    ...geoColumns(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_log_trck_user_id_idx").on(t.trckUserId),
    index("events_log_event_name_idx").on(t.eventName),
    index("events_log_created_at_idx").on(t.createdAt),
    index("events_log_event_name_created_at_idx").on(t.eventName, t.createdAt),
    // Retenção: só linhas que ainda têm payload (o job diário não relê o que já limpou).
    index("events_log_retention_idx")
      .on(t.createdAt)
      .where(
        sql`${t.payloadMeta} is not null or ${t.responseMeta} is not null or ${t.payloadGa4} is not null or ${t.responseGa4} is not null`,
      ),
  ],
);

// ---------------------------------------------------------------- vendas

export const purchases = pgTable(
  "purchases",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    transactionId: text("transaction_id").notNull().unique(),
    trckUserId: text("trck_user_id"),
    email: text("email"),
    emHash: text("em_hash"),
    phHash: text("ph_hash"),
    fnHash: text("fn_hash"),
    lnHash: text("ln_hash"),
    product: text("product"),
    items: jsonb("items"),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    netValue: numeric("net_value", { precision: 14, scale: 2 }),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    paymentMethod: text("payment_method"),
    ...utmColumns(),
    src: text("src"),
    fbp: text("fbp"),
    fbc: text("fbc"),
    fbclid: text("fbclid"),
    ...geoColumns(),
    /** Vinculação ao visitante: { found, by: 'trck_user_id' | 'email' | 'phone' | null, reason } */
    match: jsonb("match"),
    metaEventId: text("meta_event_id"),
    metaSentAt: timestamp("meta_sent_at", { withTimezone: true }),
    payloadMeta: jsonb("payload_meta"),
    responseMeta: jsonb("response_meta"),
    gaClientId: text("ga_client_id"),
    gaSessionId: text("ga_session_id"),
    ga4SentAt: timestamp("ga4_sent_at", { withTimezone: true }),
    payloadGa4: jsonb("payload_ga4"),
    responseGa4: jsonb("response_ga4"),
    /** Último payload bruto do webhook (auditoria). */
    webhookRaw: jsonb("webhook_raw"),
    /** Quando a venda aconteceu (occurredAt do evento de aprovação). */
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    /** Envio: tentativas e último erro (o reenvio automático para em 5 tentativas). */
    metaAttempts: integer("meta_attempts").notNull().default(0),
    ga4Attempts: integer("ga4_attempts").notNull().default(0),
    lastDeliveryError: text("last_delivery_error"),
    /** refund enviado ao GA4 (reembolso/chargeback). */
    refundSentAt: timestamp("refund_sent_at", { withTimezone: true }),
    refundResponseGa4: jsonb("refund_response_ga4"),
    ...timestamps(),
  },
  (t) => [
    index("purchases_trck_user_id_idx").on(t.trckUserId),
    index("purchases_status_idx").on(t.status),
    index("purchases_created_at_idx").on(t.createdAt),
    index("purchases_utm_campaign_idx").on(t.utmCampaign),
  ],
);

/** Todo evento recebido no webhook (idempotência + auditoria). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull().default("simintpay"),
    /** eventId enviado pela plataforma (único). */
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    orderId: text("order_id"),
    signatureValid: boolean("signature_valid").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    index("webhook_events_order_id_idx").on(t.orderId),
    index("webhook_events_received_at_idx").on(t.receivedAt),
  ],
);

// ---------------------------------------------------------------- Meta Ads

export const metaInsightsCache = pgTable(
  "meta_insights_cache",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    adAccountId: text("ad_account_id").notNull(),
    cacheKey: text("cache_key").notNull().unique(),
    level: text("level").notNull(),
    since: date("since"),
    until: date("until"),
    data: jsonb("data").notNull(),
    /** Header X-Business-Use-Case-Usage da última chamada. */
    usage: jsonb("usage"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meta_insights_cache_account_fetched_idx").on(t.adAccountId, t.fetchedAt)],
);

// ---------------------------------------------------------------- manutenção

/** Execuções da limpeza diária (pg_cron → app_private.run_retention). Escrita só pelo dono do banco. */
export const maintenanceRuns = pgTable(
  "maintenance_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    job: text("job").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** running | ok | erro */
    status: text("status").notNull().default("running"),
    rowsPayloads: integer("rows_payloads").notNull().default(0),
    rowsSessions: integer("rows_sessions").notNull().default(0),
    rowsCache: integer("rows_cache").notNull().default(0),
    error: text("error"),
  },
  (t) => [
    index("maintenance_runs_started_idx").on(t.startedAt),
    check("maintenance_runs_status", sql`${t.status} in ('running', 'ok', 'erro')`),
  ],
);
