import { HttpException, HttpStatus } from "@nestjs/common";

/** Chaves guardadas por limitador. Passou disso, a mais antiga sai (nunca zera tudo de uma vez). */
const MAX_KEYS = 20_000;

/**
 * Limite simples por chave (em geral o IP de rateLimitKey) numa janela deslizante, na memória do
 * processo. Vale para UMA instância e zera num restart: é uma trava contra abuso, não uma cota exata.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
	const hits = new Map<string, number[]>();
	return {
		/** true = pode seguir; false = estourou o limite (responder 429). */
		take(key: string): boolean {
			const now = Date.now();
			const previous = hits.get(key);
			const recent = (previous ?? []).filter(t => now - t < windowMs);
			if (recent.length >= max) {
				hits.set(key, recent);
				return false;
			}
			recent.push(now);
			if (previous)
				hits.delete(key); // reinsere no fim: o Map mantém a ordem de inserção (LRU simples)
			else if (hits.size >= MAX_KEYS) {
				// Descarta só a chave mais antiga: quem inunda com IPs novos não apaga o contador dos outros.
				const oldest = hits.keys().next().value;
				if (oldest !== undefined) hits.delete(oldest);
			}
			hits.set(key, recent);
			return true;
		},
	};
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/** Responde 429 quando a chave estourou o limite. */
export function enforce(
	limiter: RateLimiter,
	key: string,
	message = "Muitas requisições. Aguarde um pouco e tente de novo.",
) {
	if (!limiter.take(key)) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}
