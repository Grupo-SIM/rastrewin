import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/*
 * O app conecta como `app_login` (sem privilégios próprios, NOINHERIT) e cada pool
 * já abre a conexão no papel certo (parâmetro de inicialização `-c role=...`; o
 * Postgres recusa a conexão se app_login não puder assumir esse papel):
 *   - serviceDb(): app_service — escrita. SÓ código de servidor (API, server actions, auth).
 *   - reader:      app_reader  — só leitura, e a RLS só libera linhas se `app.user_id`
 *                  for um usuário válido. Use via `readAsUser()` em src/lib/dal.ts.
 * Sem o papel, a conexão nem abre (falha fechada).
 */

/** `$client` = o Pool do papel (a limpeza diária usa uma conexão dedicada para a trava). */
export type Database = NodePgDatabase<typeof schema> & { $client: Pool };
type Role = "app_service" | "app_reader";

const globalForDb = globalThis as unknown as { __rastrewinDb?: Partial<Record<Role, Database>> };
const cache = (globalForDb.__rastrewinDb ??= {});

function connect(role: Role, max: number): Database {
	const existing = cache[role];
	if (existing) return existing;

	const pool = new Pool({
		application_name: `rastrewin:${role}`,
		connectionString: env().DATABASE_URL,
		connectionTimeoutMillis: 10_000,
		idleTimeoutMillis: 30_000,
		max,
		options: `-c role=${role}`,
	});
	pool.on("error", error => console.error(`[db] erro no pool ${role}`, error));

	const db = drizzle(pool, { schema });
	cache[role] = db;
	return db;
}

/** Conexão de ESCRITA (app_service). Nunca exponha para o cliente. */
export function serviceDb(): Database {
	return connect("app_service", 10);
}

export type ReaderTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Leitura com RLS como o usuário `userId`. Prefira `readAsUser()` (src/lib/dal.ts),
 * que valida a sessão antes de chamar esta função.
 */
export async function withReader<T>(userId: string, fn: (tx: ReaderTx) => Promise<T>): Promise<T> {
	return connect("app_reader", 5).transaction(async tx => {
		await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
		return fn(tx);
	});
}
