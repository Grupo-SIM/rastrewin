/**
 * Apaga um usuário do painel (e as sessões dele).
 *
 *   npm run delete-user -- --email voce@empresa.com
 *   docker compose run --rm app node scripts/delete-user.mjs --email ...
 */
import { parseArgs } from "node:util";
import { Client } from "pg";

async function main() {
	const { values } = parseArgs({ options: { email: { type: "string" } } });
	const email = values.email?.trim().toLowerCase();
	if (!email) throw new Error("Informe --email");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("Defina DATABASE_URL");
	const client = new Client({ application_name: "rastrewin:delete-user", connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("SET LOCAL ROLE app_service");
		const result = await client.query('delete from "user" where email = $1', [email]);
		await client.query("COMMIT");
		if (!result.rowCount) throw new Error(`Nenhum usuário com o email ${email}`);
		console.log(`✓ usuário apagado: ${email}`);
	} catch (error) {
		await client.query("ROLLBACK").catch(() => {});
		throw error;
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error("✗", error instanceof Error ? error.message : error);
	process.exit(1);
});
