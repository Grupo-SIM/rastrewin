/*
 * Constantes do filtro "Afiliado" que a tela (client) e a consulta (servidor) compartilham.
 * A regra SQL fica em `affiliateFilter` (context.ts).
 */

/** Valor de `?afiliado=` para "Sem afiliado" (o til não existe num código válido). */
export const NO_AFFILIATE = "~sem";

/** Formato do código do afiliado (igual ao do cookie _trck_aff e ao do evento da SimIntPay). */
export const AFFILIATE_PARAM = /^[A-Za-z0-9_-]{3,40}$/;
