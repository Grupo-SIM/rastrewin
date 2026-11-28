/*
 * Constantes do filtro "Afiliado" que a tela (client) e a consulta (servidor) compartilham.
 * A regra SQL fica em `affiliateFilter` (context.ts).
 */

/** Valor de `?afiliado=` para "Sem afiliados" (o til não existe num código válido). */
export const NO_AFFILIATE = "~sem";

/** Valor de `?afiliado=` para "Todos os afiliados": só o que veio de algum afiliado, somado. */
export const ANY_AFFILIATE = "~todos";

/** O valor é uma das opções especiais (sem afiliados / todos os afiliados), não um código. */
export const isAffiliateGroup = (v: string) => v === NO_AFFILIATE || v === ANY_AFFILIATE;

/** Formato do código do afiliado (igual ao do cookie _trck_aff e ao do evento da SimIntPay). */
export const AFFILIATE_PARAM = /^[A-Za-z0-9_-]{3,40}$/;
