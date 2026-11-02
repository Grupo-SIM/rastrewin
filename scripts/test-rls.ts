/**
 * Testa a segurança do banco (RLS, papéis, grants e cifra). Termina com código 1 se algo falhar.
 *
 *   npm run test:rls
 *
 * Usa DATABASE_URL (app_login) e MIGRATION_DATABASE_URL (dono, só para conferir o catálogo).
 * Cria dados temporários com prefixo "rls-test-" e apaga tudo no final.
 */
import { Client } from "pg";

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];
const PREFIX = "rls-test-";

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

/** Roda `fn` numa transação com o papel indicado e desfaz tudo no final. */
async function asRole<T>(
  client: Client,
  role: "app_service" | "app_reader" | null,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    if (role) await client.query(`SET LOCAL ROLE ${role}`);
    if (userId !== null) await client.query("select set_config('app.user_id', $1, true)", [userId]);
    return await fn();
  } finally {
    await client.query("ROLLBACK");
  }
}

/**
 * Espera que a query seja negada: 42501 = sem permissão; 42P01 = nem enxerga a tabela
 * (sem USAGE no schema), que é uma negação ainda mais forte.
 */
const DENIED = new Set(["42501", "42P01"]);
async function expectDenied(client: Client, name: string, role: "app_service" | "app_reader" | null, userId: string | null, query: string, params: unknown[] = []) {
  try {
    await asRole(client, role, userId, () => client.query(query, params));
    record(name, false, "a query deveria ter sido negada");
  } catch (error) {
    const code = (error as { code?: string }).code;
    const ok = !!code && DENIED.has(code);
    record(name, ok, ok ? undefined : `erro inesperado: ${(error as Error).message}`);
  }
}

async function countAs(client: Client, role: "app_reader" | "app_service", userId: string | null, query: string, params: unknown[] = []) {
  return asRole(client, role, userId, async () => Number((await client.query(query, params)).rows[0].n));
}

async function main() {
  const appUrl = process.env.DATABASE_URL;
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  if (!appUrl || !ownerUrl) throw new Error("Defina DATABASE_URL e MIGRATION_DATABASE_URL");

  const owner = new Client({ connectionString: ownerUrl });
  const app = new Client({ connectionString: appUrl });
  await owner.connect();
  await app.connect();

  const validUser = `${PREFIX}valid`;
  const expiredUser = `${PREFIX}expired`;
  const key = "chave-de-teste-com-mais-de-32-caracteres!!";

  try {
    // ---------------------------------------------------------------- catálogo
    const unsecured = await owner.query<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (not c.relrowsecurity or not c.relforcerowsecurity)`);
    record(
      "toda tabela de public tem RLS ligada e FORÇADA",
      unsecured.rowCount === 0,
      unsecured.rows.map((r) => r.relname).join(", ") || undefined,
    );

    const roles = await owner.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolinherit: boolean; rolcanlogin: boolean }>(
      "select rolname, rolsuper, rolbypassrls, rolinherit, rolcanlogin from pg_roles where rolname in ('app_login','app_service','app_reader')",
    );
    const byName = Object.fromEntries(roles.rows.map((r) => [r.rolname, r]));
    record("papéis app_login/app_service/app_reader existem", roles.rowCount === 3);
    record(
      "nenhum papel do app é superusuário ou ignora RLS",
      roles.rows.every((r) => !r.rolsuper && !r.rolbypassrls),
    );
    record("app_login é NOINHERIT (não herda privilégios)", byName.app_login?.rolinherit === false);
    record("app_service e app_reader não fazem login", !byName.app_service?.rolcanlogin && !byName.app_reader?.rolcanlogin);

    const who = await app.query<{ current_user: string }>("select current_user");
    record("o app conecta como app_login", who.rows[0].current_user === "app_login");

    // ---------------------------------------------------------------- dados de teste (como app_service)
    await app.query("BEGIN");
    await app.query("SET LOCAL ROLE app_service");
    await app.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at) values
       ($1, 'RLS válido', $1 || '@test.local', true, now(), now()),
       ($2, 'RLS expirado', $2 || '@test.local', true, now(), now())`,
      [validUser, expiredUser],
    );
    await app.query(
      `insert into session (id, token, user_id, expires_at, created_at, updated_at) values
       ($1 || 's1', $1 || 't1', $1, now() + interval '1 hour', now(), now()),
       ($2 || 's2', $2 || 't2', $2, now() - interval '1 hour', now(), now())`,
      [validUser, expiredUser],
    );
    await app.query("insert into visitors (trck_user_id) values ($1)", [`${PREFIX}visitor`]);
    await app.query(
      `insert into meta_pixels (label, pixel_id, capi_token_enc, capi_token_hint)
       values ('RLS', '999999999999', pgp_sym_encrypt('token-secreto', $1), '••••reto')`,
      [key],
    );
    await app.query("COMMIT");
    record("app_service escreve (insert em user/session/visitors/meta_pixels)", true);

    // ---------------------------------------------------------------- app_login sem papel
    await expectDenied(app, "app_login sem SET ROLE não lê nada", null, null, "select count(*) from visitors");
    await expectDenied(app, "app_login não consegue virar o dono do banco", null, null, "set role postgres");

    // ---------------------------------------------------------------- leitura no painel (app_reader)
    const visitorQ = "select count(*) as n from visitors where trck_user_id = $1";
    const visitorP = [`${PREFIX}visitor`];
    record("app_reader SEM sessão vê 0 linhas", (await countAs(app, "app_reader", null, visitorQ, visitorP)) === 0);
    record("app_reader com usuário inexistente vê 0 linhas", (await countAs(app, "app_reader", `${PREFIX}nope`, visitorQ, visitorP)) === 0);
    record("app_reader com sessão EXPIRADA vê 0 linhas", (await countAs(app, "app_reader", expiredUser, visitorQ, visitorP)) === 0);
    record("app_reader com sessão válida vê os dados", (await countAs(app, "app_reader", validUser, visitorQ, visitorP)) === 1);
    record(
      "app_reader lê colunas não secretas (label/pista do token)",
      (await countAs(app, "app_reader", validUser, "select count(label) as n from meta_pixels where pixel_id = '999999999999'")) === 1,
    );
    await expectDenied(app, "app_reader NÃO lê segredo cifrado (capi_token_enc)", "app_reader", validUser, "select capi_token_enc from meta_pixels");
    await expectDenied(app, "app_reader NÃO faz SELECT * em tabela com segredo", "app_reader", validUser, "select * from meta_pixels");
    await expectDenied(app, "app_reader NÃO insere", "app_reader", validUser, "insert into visitors (trck_user_id) values ('x')");
    await expectDenied(app, "app_reader NÃO atualiza", "app_reader", validUser, "update visitors set email = 'x'");
    await expectDenied(app, "app_reader NÃO apaga", "app_reader", validUser, "delete from visitors");
    await expectDenied(app, "app_reader NÃO lê tabelas de login (session)", "app_reader", validUser, "select count(*) from session");
    await expectDenied(app, "app_reader NÃO lê tabelas de login (account)", "app_reader", validUser, "select count(*) from account");

    // ---------------------------------------------------------------- cifra
    const decrypted = await asRole(app, "app_service", null, async () =>
      (await app.query("select pgp_sym_decrypt(capi_token_enc, $1) as v from meta_pixels where pixel_id = '999999999999'", [key])).rows[0].v,
    );
    record("app_service decifra o segredo com a chave certa", decrypted === "token-secreto");
    try {
      await asRole(app, "app_service", null, () =>
        app.query("select pgp_sym_decrypt(capi_token_enc, 'chave-errada') from meta_pixels where pixel_id = '999999999999'"),
      );
      record("chave errada NÃO decifra", false);
    } catch {
      record("chave errada NÃO decifra", true);
    }
    const stored = await asRole(app, "app_service", null, async () =>
      (await app.query("select encode(capi_token_enc, 'escape') as raw from meta_pixels where pixel_id = '999999999999'")).rows[0].raw as string,
    );
    record("o segredo não fica em texto puro no banco", !stored.includes("token-secreto"));

    // ---------------------------------------------------------------- settings
    const settingsRows = await countAs(app, "app_reader", validUser, "select count(*) as n from settings");
    record("settings tem exatamente 1 linha", settingsRows === 1);
  } finally {
    await app.query("ROLLBACK").catch(() => {});
    await app.query("BEGIN");
    await app.query("SET LOCAL ROLE app_service");
    await app.query("delete from meta_pixels where pixel_id = '999999999999'");
    await app.query("delete from visitors where trck_user_id like $1", [`${PREFIX}%`]);
    await app.query(`delete from "user" where id like $1`, [`${PREFIX}%`]);
    await app.query("COMMIT");
    await app.end();
    await owner.end();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
  if (failed) process.exit(1);
}

main().catch((error: unknown) => {
  console.error("✗ erro ao rodar o teste:", error instanceof Error ? error.message : error);
  process.exit(1);
});
