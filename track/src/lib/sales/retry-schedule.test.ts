import assert from "node:assert/strict";
import { test } from "node:test";
import { isAttemptDue, MAX_ATTEMPTS, nextAttemptAt, RETRY_OFFSETS_MS } from "./retry-schedule";
import { META_MAX_AGE_MS } from "./simintpay";

const HOUR = 3_600_000;
const sale = new Date("2026-11-28T12:12:00Z");
const at = (ms: number) => new Date(sale.getTime() + ms);

test("21 tentativas: na hora, +5 min, +15 min, +30 min, +1 h, +2 h, +4 h, +8 h, +12 h e depois a cada 12 h", () => {
	assert.equal(MAX_ATTEMPTS, 21);
	assert.deepEqual(
		RETRY_OFFSETS_MS.slice(0, 9).map(ms => ms / 60_000),
		[0, 5, 15, 30, 60, 120, 240, 480, 720],
	);
	assert.deepEqual(
		RETRY_OFFSETS_MS.slice(9).map(ms => ms / HOUR),
		[24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156],
	);
});

test("a última tentativa ainda cabe no prazo de 7 dias da Conversions API", () => {
	assert.ok((RETRY_OFFSETS_MS.at(-1) ?? 0) < META_MAX_AGE_MS);
	for (let i = 1; i < RETRY_OFFSETS_MS.length; i++)
		assert.ok((RETRY_OFFSETS_MS[i] ?? 0) > (RETRY_OFFSETS_MS[i - 1] ?? 0), "sempre crescente");
});

test("próxima tentativa é contada a partir da venda; esgotada = null", () => {
	assert.deepEqual(nextAttemptAt(sale, 0), sale);
	assert.deepEqual(nextAttemptAt(sale, 1), at(5 * 60_000));
	assert.deepEqual(nextAttemptAt(sale, 6), at(4 * HOUR));
	assert.equal(nextAttemptAt(sale, MAX_ATTEMPTS), null);
	assert.equal(nextAttemptAt(sale, 99), null);
});

test("só reenvia quando chega a hora da tentativa seguinte", () => {
	// 1 tentativa feita (na hora): a 2ª sai aos 5 min, não antes.
	assert.equal(isAttemptDue(sale, 1, at(4 * 60_000)), false);
	assert.equal(isAttemptDue(sale, 1, at(5 * 60_000)), true);
	// Pane de horas: 6 tentativas feitas, a 7ª só às +4 h.
	assert.equal(isAttemptDue(sale, 6, at(3 * HOUR)), false);
	assert.equal(isAttemptDue(sale, 6, at(4 * HOUR)), true);
	assert.equal(isAttemptDue(sale, MAX_ATTEMPTS, at(200 * HOUR)), false);
});
