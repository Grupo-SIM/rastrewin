import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { serviceDb } from "@/db";
import * as schema from "@/db/schema";
import { ADMIN_API_PATHS } from "@/lib/auth-admin-paths";
import { env } from "@/lib/env";
import { DEFAULT_ROLE } from "@/lib/roles";

/*
 * Permissões do plugin admin. "admin" pode gerir usuários e sessões, SEM personificação
 * ("impersonate"/"impersonate-admins" ficam de fora). "colaborador" não pode nada no plugin.
 * Os nomes precisam bater com ROLES (src/lib/roles.ts) e com o CHECK do banco.
 */
const accessControl = createAccessControl(defaultStatements);
const roles = {
	admin: accessControl.newRole({
		session: ["list", "revoke", "delete"],
		user: ["create", "list", "set-role", "ban", "delete", "set-password", "set-email", "get", "update"],
	}),
	colaborador: accessControl.newRole({ session: [], user: [] }),
};

/*
 * Login do painel. Cadastro público DESLIGADO: usuários via `npm run create-admin` ou pela aba Usuários.
 * Níveis (admin/colaborador) pelo plugin admin; as rotas HTTP dele ficam fechadas (src/lib/auth-admin-paths.ts).
 * Se mudar opções que afetam o schema, espelhe em scripts/auth-schema.config.ts e regenere.
 */
function createAuth() {
	const { APP_URL, BETTER_AUTH_SECRET } = env();
	return betterAuth({
		advanced: {
			// Mesma regra de src/lib/http/client-ip.ts: X-Real-IP sobrescrito pelo nosso proxy.
			// O Better Auth só aceita X-Forwarded-For de valor único (o proxy do deploy/ sobrescreve com o IP da conexão).
			ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
			useSecureCookies: APP_URL.startsWith("https://"),
		},
		appName: "Rastrewin",
		baseURL: APP_URL,
		database: drizzleAdapter(serviceDb(), { provider: "pg", schema }),
		// Rotas HTTP do plugin admin fechadas (404): gestão só pelas Server Actions do painel.
		disabledPaths: [...ADMIN_API_PATHS],
		emailAndPassword: {
			autoSignIn: false,
			disableSignUp: true,
			enabled: true,
			minPasswordLength: 12,
		},
		plugins: [
			admin({
				ac: accessControl,
				adminRoles: ["admin"],
				bannedUserMessage: "Conta desativada. Fale com o administrador.",
				defaultRole: DEFAULT_ROLE,
				roles,
			}),
			nextCookies(), // sempre o último plugin
		],
		rateLimit: {
			customRules: {
				"/sign-in/email": { max: 5, window: 60 },
			},
			enabled: true,
			max: 60,
			window: 60,
		},
		secret: BETTER_AUTH_SECRET,
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 dias
			updateAge: 60 * 60 * 24, // renova 1x/dia com uso
		},
		trustedOrigins: [APP_URL],
	});
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __rastrewinAuth?: Auth };

/** Instância preguiçosa: o `next build` roda sem env, então nada é lido no import. */
export function getAuth(): Auth {
	return (globalForAuth.__rastrewinAuth ??= createAuth());
}
