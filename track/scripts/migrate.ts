/**
 * Aplica as migrations (pasta drizzle/) conectando como DONO do banco
 * e, se a DATABASE_URL usar o usuário app_login, sincroniza a senha dele.
 *
 *   npm run db:migrate                                  (local, lê .env)
 *   docker compose run --rm migrate                     (produção)
 *
 * Variáveis: MIGRATION_DATABASE_URL (dono) e DATABASE_URL (opcional; só é usada se for app_login).
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

/** Senha do app_login na DATABASE_URL, ou undefined quando o app conecta com outro usuário. */
function appLoginPassword(): string | undefined {
	const raw = process.env.DATABASE_URL;
	if (!raw) return undefined;
	const url = new URL(raw);
	if (decodeURIComponent(url.username) !== "app_login") return undefined;
	const password = decodeURIComponent(url.password);
	if (password.length < 24)
		throw new Error("A senha do app_login (DATABASE_URL) precisa ter 24+ caracteres");
	return password;
}

async function main() {
	const ownerUrl = required("MIGRATION_DATABASE_URL");
	const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
	const client = new Client({ application_name: "rastrewin:migrate", connectionString: ownerUrl });
	await client.connect();
	try {
		console.log(`→ aplicando migrations de ${migrationsFolder}`);
		await migrate(drizzle(client), { migrationsFolder });

		const appLogin = appLoginPassword();
		if (appLogin) {
			// Senha do app_login (format %L faz o escape com segurança).
			const { rows } = await client.query<{ stmt: string }>(
				"select format('ALTER ROLE app_login WITH LOGIN PASSWORD %L', $1::text) as stmt",
				[appLogin],
			);
			await client.query(rows[0].stmt);
			console.log("✓ migrations aplicadas e senha do app_login sincronizada");
		} else {
			console.log("✓ migrations aplicadas (DATABASE_URL não usa app_login: senha não alterada)");
		}
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error("✗ falha na migração:", error instanceof Error ? error.message : error);
	process.exit(1);
});
