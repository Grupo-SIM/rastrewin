import assert from "node:assert/strict";
import { test } from "node:test";
import { capiFailureReason } from "./capi-errors";

test("token sem acesso ao pixel (código 100, subcódigo 33) vira a frase do Testar conexão", () => {
	const body = { error: { code: 100, error_subcode: 33, message: "Unsupported post request" } };
	assert.equal(
		capiFailureReason({ body, status: 400 }),
		"este token não tem acesso a este pixel (ou o ID do pixel está errado)",
	);
});

test("token inválido e outros erros da Graph API usam a descrição de sempre, sem ponto final", () => {
	assert.equal(
		capiFailureReason({ body: { error: { code: 190, message: "x" } }, status: 400 }),
		"token inválido ou expirado. Gere um novo token e salve de novo",
	);
	assert.equal(capiFailureReason({ body: { error: { message: "Algo novo" } }, status: 500 }), "algo novo");
});

test("sem corpo de erro: HTTP ou falha de rede", () => {
	assert.equal(capiFailureReason({ body: null, status: 502 }), "a Meta respondeu HTTP 502");
	assert.equal(capiFailureReason({ body: null, status: 0 }), "falha de rede ao falar com a Meta");
	assert.equal(capiFailureReason({ body: { error: "falha interna no envio" } }), "falha interna no envio");
});
