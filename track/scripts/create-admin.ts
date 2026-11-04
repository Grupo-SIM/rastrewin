import readline from "node:readline";
import { parseArgs } from "node:util";
/**
 * Cria um usuário do painel (o cadastro público é desligado).
 *
 *   npm run create-admin -- --email voce@empresa.com --name "Seu Nome"
 *   docker compose run --rm -it app node scripts/create-admin.mjs --email ... --name ...
 *
 * A senha é pedida no terminal, sem aparecer na tela, e nunca vai como argumento.
 * Sem terminal interativo, ela é lida da primeira linha do stdin.
 */
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { Client } from "pg";

const MIN_PASSWORD = 12;

function askHidden(question: string): Promise<string> {
	return new Promise(resolve => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
		let muted = false;
		output._writeToOutput = (s: string) => {
			if (!muted) output.output.write(s);
		};
		rl.question(question, answer => {
			rl.close();
			process.stdout.write("\n");
			resolve(answer);
		});
		muted = true;
	});
}

async function readStdinLine(): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin });
	for await (const line of rl) {
		rl.close();
		return line;
	}
	return "";
}

async function main() {
	const { values } = parseArgs({
		options: { email: { type: "string" }, name: { type: "string" } },
	});
	const email = values.email?.trim().toLowerCase();
	const name = values.name?.trim() || "Admin";
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe --email válido");

	let password: string;
	if (process.stdin.isTTY) {
		password = await askHidden("Senha (mín. 12 caracteres): ");
		const confirm = await askHidden("Confirme a senha: ");
		if (password !== confirm) throw new Error("As senhas não conferem");
	} else {
		password = await readStdinLine();
	}
	if (password.length < MIN_PASSWORD) throw new Error(`A senha precisa ter ${MIN_PASSWORD}+ caracteres`);

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("Defina DATABASE_URL");
	const client = new Client({ application_name: "rastrewin:create-admin", connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("SET LOCAL ROLE app_service");
		const exists = await client.query('select 1 from "user" where email = $1', [email]);
		if (exists.rowCount) throw new Error(`Já existe um usuário com o email ${email}`);

		const userId = generateRandomString(32, "a-z", "A-Z", "0-9");
		const accountId = generateRandomString(32, "a-z", "A-Z", "0-9");
		const hash = await hashPassword(password);
		await client.query(
			`insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $2, $3, true, now(), now())`,
			[userId, name, email],
		);
		await client.query(
			`insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
       values ($1, $2, 'credential', $2, $3, now(), now())`,
			[accountId, userId, hash],
		);
		await client.query("COMMIT");
		console.log(`✓ usuário criado: ${email}`);
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
