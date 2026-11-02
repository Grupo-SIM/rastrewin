import "server-only";
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { env } from "@/lib/env";

/*
 * Segredos (tokens, api_secret) ficam em colunas bytea `*_enc`, cifrados no Postgres
 * com pgcrypto (pgp_sym_encrypt, AES-256). A chave vem do env do servidor e vai como
 * PARÂMETRO da query — nunca é gravada no banco nem concatenada no SQL.
 * Só o papel app_service consegue ler as colunas `*_enc`.
 */

/** SQL que cifra `plain` — use em INSERT/UPDATE. */
export function encryptSecret(plain: string): SQL {
  return sql`pgp_sym_encrypt(${plain}, ${env().ENCRYPTION_KEY}, 'cipher-algo=aes256, compress-algo=0')`;
}

/** SQL que decifra a coluna — use em SELECT feito com serviceDb(). */
export function decryptSecret(column: SQLWrapper): SQL<string> {
  return sql<string>`pgp_sym_decrypt(${column}, ${env().ENCRYPTION_KEY})`;
}

/** Pista para exibir o segredo mascarado no painel: "••••1a2b". */
export function secretHint(plain: string): string {
  const tail = plain.trim().slice(-4);
  return `••••${tail}`;
}
