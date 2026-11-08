import assert from "node:assert/strict";
import { test } from "node:test";
import {
	countryName,
	delta,
	formatBytes,
	formatDayRangeShort,
	formatDelta,
	formatMoney,
	formatPct,
	formatRoas,
} from "./format";

const nb = (s: string) => s.replace(/ /g, " ");

test("dinheiro e percentuais em pt-BR", () => {
	assert.equal(nb(formatMoney(1234.5)), "R$ 1.234,50");
	assert.equal(formatPct(0.1234), "12,3%");
	assert.equal(formatPct(null), "—");
	assert.equal(formatRoas(2.345), "2,35");
	assert.equal(formatRoas(3), "3,00");
	assert.equal(formatRoas(null), "—");
	assert.equal(formatDayRangeShort({ from: "2026-11-06", to: "2026-11-06" }), "06/11");
	assert.equal(formatDayRangeShort({ from: "2026-10-31", to: "2026-11-06" }), "31/10 a 06/11");
});

test("delta entre períodos", () => {
	assert.equal(delta(120, 100), 0.2);
	assert.equal(delta(0, 0), 0);
	assert.equal(delta(5, 0), "novo");
	assert.equal(delta(null, 0.1), null); // ex.: conversão sem visitantes no período
	assert.equal(delta(0, null), null); // ex.: período anterior sem base
	assert.equal(formatDelta(0.2), "+20%");
	assert.equal(formatDelta(-0.05), "−5%");
	assert.equal(formatDelta("novo"), "novo");
	assert.equal(formatDelta(null), "sem comparação");
});

test("nome do país", () => {
	assert.equal(countryName("BR"), "Brasil");
	assert.equal(countryName(null), "Desconhecido");
});

test("tamanho em bytes", () => {
	assert.equal(formatBytes(0), "0 B");
	assert.equal(formatBytes(512), "512 B");
	assert.equal(formatBytes(12 * 1024), "12 KB");
	assert.equal(formatBytes(3.45 * 1024 ** 2), "3,5 MB");
	assert.equal(formatBytes(5 * 1024 ** 3), "5 GB");
});
