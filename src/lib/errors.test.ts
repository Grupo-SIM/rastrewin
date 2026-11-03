import assert from "node:assert/strict";
import { test } from "node:test";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { redactSecrets, safeErrorMessage, secretValuesFromEnv } from "./errors";

const KEY = "chave-mestra-de-teste-0123456789abcdef";

test("safeErrorMessage tira SQL e parâmetros de erros de query (chave, tokens, PII)", () => {
  const cause = Object.assign(new Error("connection terminated unexpectedly"), { code: "57P01" });
  const err = new DrizzleQueryError("select pgp_sym_decrypt(col, $1) from settings", [KEY, "comprador@exemplo.com"], cause);
  assert.ok(err.message.includes(KEY), "pré-condição: o Drizzle põe os parâmetros na mensagem");
  const msg = safeErrorMessage(err);
  assert.equal(msg, "erro no banco (57P01): connection terminated unexpectedly");
  assert.ok(!msg.includes(KEY) && !msg.includes("comprador@exemplo.com"));
});

test("safeErrorMessage mantém erros comuns e aceita qualquer valor", () => {
  assert.equal(safeErrorMessage(new Error("timeout")), "timeout");
  assert.equal(safeErrorMessage("texto"), "texto");
  assert.equal(safeErrorMessage({ x: 1 }), "erro desconhecido");
});

test("redação dos logs troca os segredos do env", () => {
  const secrets = secretValuesFromEnv({
    ENCRYPTION_KEY: KEY,
    BETTER_AUTH_SECRET: "curta",
    DATABASE_URL: "postgres://app_login:senha-do-app-login-123456@db:5432/rastrewin",
  });
  assert.deepEqual(secrets, [KEY, "senha-do-app-login-123456"]);
  assert.equal(redactSecrets(`params: ${KEY},x ${KEY}`, secrets), "params: [REDACTED],x [REDACTED]");
  assert.equal(redactSecrets("nada a esconder", secrets), "nada a esconder");
});
