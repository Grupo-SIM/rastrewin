import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { serviceDb } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

/*
 * Login do painel. Cadastro público DESLIGADO: usuários só via `npm run create-admin`.
 * Se mudar opções que afetam o schema, espelhe em scripts/auth-schema.config.ts e regenere.
 */
function createAuth() {
  const { APP_URL, BETTER_AUTH_SECRET } = env();
  return betterAuth({
    appName: "Rastrewin",
    baseURL: APP_URL,
    secret: BETTER_AUTH_SECRET,
    trustedOrigins: [APP_URL],
    database: drizzleAdapter(serviceDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      autoSignIn: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 dias
      updateAge: 60 * 60 * 24, // renova 1x/dia com uso
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: APP_URL.startsWith("https://"),
      // Mesma regra de src/lib/http/client-ip.ts: X-Real-IP sobrescrito pelo nosso proxy.
      // O Better Auth só aceita X-Forwarded-For de valor único (o proxy do deploy/ sobrescreve com o IP da conexão).
      ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __rastrewinAuth?: Auth };

/** Instância preguiçosa: o `next build` roda sem env, então nada é lido no import. */
export function getAuth(): Auth {
  return (globalForAuth.__rastrewinAuth ??= createAuth());
}
