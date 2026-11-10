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
			const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
			if (recent.length >= max) {
				hits.set(key, recent);
				return false;
			}
			recent.push(now);
			hits.set(key, recent);
			if (hits.size > 10_000) hits.clear(); // não cresce sem fim com IPs variados
			return true;
		},
	};
}
