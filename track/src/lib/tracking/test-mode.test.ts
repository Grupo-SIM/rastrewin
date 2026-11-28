import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { notTest, TEST_RESPONSE } from "./test-mode";

const render = (column: string) => new PgDialect().sqlToQuery(notTest(column)).sql;

test("notTest compara o visitante de teste com a coluna QUALIFICADA da tabela consultada", () => {
	assert.equal(
		render("events_log.trck_user_id"),
		"not exists (select 1 from visitors tv where tv.is_test and tv.trck_user_id = events_log.trck_user_id)",
	);
	assert.match(render("p.trck_user_id"), /tv\.trck_user_id = p\.trck_user_id\)$/);
});

test("notTest recusa coluna sem tabela (dentro da subconsulta ela viraria a de visitors e tiraria tudo)", () => {
	assert.throws(() => notTest("trck_user_id"), /não qualificada/);
	assert.throws(() => notTest("l.email"), /não qualificada/);
	assert.throws(() => notTest("l.trck_user_id; drop table x"), /não qualificada/);
});

test("a resposta de teste não tem `ok` nem `error`: o status do painel é 'teste', não 'erro'", () => {
	assert.deepEqual(TEST_RESPONSE, { test: true });
});
