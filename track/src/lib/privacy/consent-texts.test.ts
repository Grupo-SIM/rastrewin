import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CONSENT_TEXTS, resolveConsentTexts } from "./consent-texts";

test("sem texto salvo, usa o padrão", () => {
	assert.deepEqual(resolveConsentTexts(null), DEFAULT_CONSENT_TEXTS);
});

test("texto do painel substitui só o campo trocado; vazio volta ao padrão", () => {
	const texts = resolveConsentTexts({ accept: "Concordo", reject: "" });
	assert.equal(texts.accept, "Concordo");
	assert.equal(texts.reject, DEFAULT_CONSENT_TEXTS.reject);
	assert.equal(texts.body, DEFAULT_CONSENT_TEXTS.body);
});

test("valor inválido salvo no banco não quebra o banner", () => {
	assert.deepEqual(resolveConsentTexts({ accept: 123 }), DEFAULT_CONSENT_TEXTS);
});
