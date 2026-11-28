/*
 * Modo teste (visitante da equipe: `?rw_teste=1` no site ou marcado na jornada do painel).
 * Nada dele vai à Meta nem ao GA4, e os relatórios ignoram seus eventos, plays e compras.
 */

/** Resposta gravada no lugar da da Meta/GA4 quando o envio foi pulado por ser teste. */
export const TEST_RESPONSE = { test: true } as const;
