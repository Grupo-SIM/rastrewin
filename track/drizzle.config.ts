import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit só GERA o SQL (npm run db:generate). Quem aplica é scripts/migrate.ts,
 * conectando como dono do banco (MIGRATION_DATABASE_URL).
 * Migrations de segurança (papéis, RLS, grants) são "custom": npm run db:generate -- --custom --name=<nome>
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
