import assert from "node:assert/strict";
import { test } from "node:test";
import { countryName, delta, formatDelta, formatMoney, formatPct } from "./format";

const nb = (s: string) => s.replace(/ /g, " ");

test("dinheiro e percentuais em pt-BR", () => {
	assert.equal(nb(formatMoney(1234.5)), "R$ 1.234,50");
	assert.equal(formatPct(0.1234), "12,3%");
	assert.equal(formatPct(null), "—");
});

test("delta entre períodos", () => {
	assert.equal(delta(120, 100), 0.2);
	assert.equal(delta(0, 0), 0);
	assert.equal(delta(5, 0), null);
	assert.equal(formatDelta(0.2), "+20%");
	assert.equal(formatDelta(-0.05), "−5%");
	assert.equal(formatDelta(null), "novo");
});

test("nome do país", () => {
	assert.equal(countryName("BR"), "Brasil");
	assert.equal(countryName(null), "Desconhecido");
});
