import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClock, retentionCurve, stopBands } from "./video-stats";

// 10 plays: 4 pararam cedo (10%), 3 no meio (55%), 1 aos 80%, 2 até o fim (100%)
const hist = [
	{ bin: 10, count: 4 },
	{ bin: 55, count: 3 },
	{ bin: 80, count: 1 },
	{ bin: 100, count: 2 },
];

test("retentionCurve: começa em 100% e só cai", () => {
	const c = retentionCurve(hist);
	assert.equal(c.length, 21);
	assert.deepEqual(c[0], { pct: 0, plays: 10, share: 1 });
	assert.deepEqual(
		c.find(p => p.pct === 10),
		{ pct: 10, plays: 10, share: 1 },
	);
	assert.deepEqual(
		c.find(p => p.pct === 15),
		{ pct: 15, plays: 6, share: 0.6 },
	);
	assert.deepEqual(
		c.find(p => p.pct === 60),
		{ pct: 60, plays: 3, share: 0.3 },
	);
	assert.deepEqual(c.at(-1), { pct: 100, plays: 2, share: 0.2 });
	for (let i = 1; i < c.length; i++) assert.ok(c[i].plays <= c[i - 1].plays);
});

test("retentionCurve: sem plays fica tudo em zero", () => {
	assert.deepEqual(retentionCurve([], 50), [
		{ pct: 0, plays: 0, share: 0 },
		{ pct: 50, plays: 0, share: 0 },
		{ pct: 100, plays: 0, share: 0 },
	]);
});

test("stopBands: onde os plays pararam, somando o total", () => {
	assert.deepEqual(stopBands(hist), [
		{ label: "Até 25%", value: 4 },
		{ label: "25% a 50%", value: 0 },
		{ label: "50% a 75%", value: 3 },
		{ label: "75% ao fim", value: 3 },
	]);
	assert.equal(
		stopBands(hist).reduce((s, b) => s + b.value, 0),
		hist.reduce((s, h) => s + h.count, 0),
	);
});

test("formatClock", () => {
	assert.equal(formatClock(0), "0:00");
	assert.equal(formatClock(75.4), "1:15");
	assert.equal(formatClock(3725), "1:02:05");
});
