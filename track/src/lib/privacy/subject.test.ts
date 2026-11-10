import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "@/lib/tracking/normalize";
import { pgTextArray, subjectHashes } from "./subject";

test("hash do titular: mesmo email/telefone normalizado que a Meta usa", () => {
	const h = subjectHashes({ email: " Ana@Exemplo.com ", phone: "(11) 99999-8888" });
	assert.equal(h.emHash, sha256("ana@exemplo.com"));
	assert.equal(h.phHash, sha256("5511999998888"));
	assert.deepEqual(subjectHashes({ email: "não é email", phone: null }), { emHash: null, phHash: null });
});

test("array do Postgres num parâmetro só, com aspas e barras escapadas", () => {
	assert.equal(pgTextArray([]), "{}");
	assert.equal(pgTextArray(["a", "b"]), '{"a","b"}');
	assert.equal(pgTextArray(['x"y', "c\\d"]), '{"x\\"y","c\\\\d"}');
});
