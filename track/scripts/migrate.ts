/**
 * Aplica as migrations (pasta drizzle/) conectando como DONO do banco e
 * define a senha do papel app_login a partir da DATABASE_URL.
 *
 *   npm run db:migrate                                  (local, lê .env)
 *   docker compose run --rm migrate                     (produção)
 *
 * Variáveis: MIGRATION_DATABASE_URL (dono) e DATABASE_URL (app_login).
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Defina ${name}`);
	return value;
}

async function main() {
	const ownerUrl = required("MIGRATION_DATABASE_URL");
	const appUrl = new URL(required("DATABASE_URL"));
	const appUser = decodeURIComponent(appUrl.username);
	const appPassword = decodeURIComponent(appUrl.password);
	if (appUser !== "app_login") throw new Error("DATABASE_URL deve usar o usuário app_login");
	if (appPassword.length < 24)
		throw new Error("A senha do app_login (DATABASE_URL) precisa ter 24+ caracteres");

	const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
	const client = new Client({ application_name: "rastrewin:migrate", connectionString: ownerUrl });
	await client.connect();
	try {
		console.log(`→ aplicando migrations de ${migrationsFolder}`);
		await migrate(drizzle(client), { migrationsFolder });

		// Senha do app_login (format %L faz o escape com segurança).
		const { rows } = await client.query<{ stmt: string }>(
			"select format('ALTER ROLE app_login WITH LOGIN PASSWORD %L', $1::text) as stmt",
			[appPassword],
		);
		await client.query(rows[0].stmt);
		console.log("✓ migrations aplicadas e senha do app_login sincronizada");
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error("✗ falha na migração:", error instanceof Error ? error.message : error);
	process.exit(1);
});
