import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/*
 * O app conecta como `app_login` (sem privilégios próprios, NOINHERIT) e cada pool
 * troca de papel ao abrir a conexão:
 *   - serviceDb(): app_service — escrita. SÓ código de servidor (API, server actions, auth).
 *   - reader:      app_reader  — só leitura, e a RLS só libera linhas se `app.user_id`
 *                  for um usuário válido. Use via `readAsUser()` em src/lib/dal.ts.
 * Se o SET ROLE falhar, as queries rodam como app_login e são negadas (falha fechada).
 */

export type Database = NodePgDatabase<typeof schema>;
type Role = "app_service" | "app_reader";

const globalForDb = globalThis as unknown as { __rastrewinDb?: Partial<Record<Role, Database>> };
const cache = (globalForDb.__rastrewinDb ??= {});

function connect(role: Role, max: number): Database {
  const existing = cache[role];
  if (existing) return existing;

  const pool = new Pool({
    connectionString: env().DATABASE_URL,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: `rastrewin:${role}`,
  });
  pool.on("connect", (client) => {
    // Executa antes de qualquer query do chamador (a fila do client é ordenada).
    client.query(`SET ROLE ${role}`).catch((error: unknown) => {
      console.error(`[db] falha no SET ROLE ${role}`, error);
    });
  });
  pool.on("error", (error) => console.error(`[db] erro no pool ${role}`, error));

  const db = drizzle(pool, { schema });
  cache[role] = db;
  return db;
}

/** Conexão de ESCRITA (app_service). Nunca exponha para o cliente. */
export function serviceDb(): Database {
  return connect("app_service", 10);
}

type ReaderTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Leitura com RLS como o usuário `userId`. Prefira `readAsUser()` (src/lib/dal.ts),
 * que valida a sessão antes de chamar esta função.
 */
export async function withReader<T>(userId: string, fn: (tx: ReaderTx) => Promise<T>): Promise<T> {
  return connect("app_reader", 5).transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
