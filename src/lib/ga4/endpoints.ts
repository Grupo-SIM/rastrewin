/**
 * Endpoints do GA4 Measurement Protocol — ÚNICO lugar para atualizar.
 * Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export const GA4_MP_COLLECT_URL = "https://www.google-analytics.com/mp/collect";
/** Servidor de validação: os eventos NÃO entram nos relatórios. Ele NÃO valida o api_secret. */
export const GA4_MP_DEBUG_URL = "https://www.google-analytics.com/debug/mp/collect";
