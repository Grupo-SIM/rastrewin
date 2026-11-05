import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do SERVIDOR. Nada aqui usa NEXT_PUBLIC_.
 * Validação é preguiçosa (no primeiro uso) para não quebrar o `next build`, que roda sem .env.
 */
const schema = z.object({
	/** URL pública do app, ex.: https://track.seudominio.com */
	APP_URL: z.url(),
	/** Segredo das sessões do login do painel. */
	BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de pelo menos 32 caracteres"),
	/** Conexão do app (app_login ou qualquer usuário que possa assumir app_service/app_reader). */
	DATABASE_URL: z.url(),
	/** Chave mestra da cifra pgcrypto dos segredos (tokens/api_secret). */
	ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY precisa de pelo menos 32 caracteres"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

export function env(): Env {
	if (cached) return cached;
	const parsed = schema.safeParse(process.env);
	if (!parsed.success) {
		const fields = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
		throw new Error(`Variáveis de ambiente inválidas — ${fields}`);
	}
	cached = parsed.data;
	return cached;
}
