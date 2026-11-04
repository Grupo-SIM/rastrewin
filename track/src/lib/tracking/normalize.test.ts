import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
	hashed,
	normCity,
	normCountry,
	normEmail,
	normName,
	normPhone,
	normState,
	sha256,
	splitFullName,
} from "./normalize";

test("sha256 em hex minúsculo", () => {
	assert.equal(sha256("abc"), createHash("sha256").update("abc").digest("hex"));
	assert.match(sha256("x"), /^[a-f0-9]{64}$/);
});

test("email: trim + minúsculo (exemplo da doc da Meta)", () => {
	assert.equal(normEmail("  John_Smith@gmail.com "), "john_smith@gmail.com");
	assert.equal(normEmail("sem-arroba"), null);
	assert.equal(normEmail(""), null);
});

test("telefone: só dígitos, sem zeros à esquerda, com DDI", () => {
	assert.equal(normPhone("+1 (650) 555-1212"), "16505551212");
	assert.equal(normPhone("(11) 99999-8888"), "5511999998888"); // BR sem DDI ganha 55
	assert.equal(normPhone("(11) 3333-4444"), "551133334444");
	assert.equal(normPhone("+55 11 99999-8888"), "5511999998888");
	assert.equal(normPhone("0055 11 99999-8888"), "5511999998888");
	assert.equal(normPhone("11 99999-8888"), "5511999998888");
	assert.equal(normPhone("+44 20 7946 0958"), "442079460958"); // internacional com 12 dígitos
	assert.equal(normPhone("123"), null);
});

test("nome: minúsculo, sem pontuação, acento mantido (UTF-8)", () => {
	assert.equal(normName("Mary"), "mary");
	assert.equal(normName("Valéry"), "valéry");
	assert.equal(normName(" Mary-Ann "), "maryann");
	assert.deepEqual(splitFullName("Maria Clara Souza"), { fn: "maria", ln: "souza" });
	assert.deepEqual(splitFullName("Cher"), { fn: "cher", ln: null });
});

test("cidade/estado/país", () => {
	assert.equal(normCity("São Paulo"), "saopaulo");
	assert.equal(normCity("New York"), "newyork");
	assert.equal(normState("São Paulo", "BR"), "sp");
	assert.equal(normState("Federal District", "BR"), "df");
	assert.equal(normState("SP", "BR"), "sp");
	assert.equal(normState("California", "US"), "california");
	assert.equal(normCountry("BR"), "br");
	assert.equal(normCountry("Brasil"), null);
});

test("hashed não refaz o hash de um hash", () => {
	const h = sha256("a@b.com");
	assert.equal(hashed(h), h);
	assert.equal(hashed(null), null);
});
