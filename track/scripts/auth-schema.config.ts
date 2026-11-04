/**
 * Usado SÓ para gerar o schema das tabelas do Better Auth:
 *   npx auth@latest generate --config scripts/auth-schema.config.ts --output src/db/schema/auth.ts
 * Mantenha as opções que afetam o schema iguais às de src/lib/auth.ts.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";

export const auth = betterAuth({
  database: drizzleAdapter(drizzle.mock(), { provider: "pg" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
});
