import assert from "node:assert/strict";
import { test } from "node:test";
import { canCall, emptyState, MAX_PER_HOUR, pause, recordCall, usagePct } from "./limiter";

test("intervalo mínimo de 10 s entre chamadas", () => {
	let s = recordCall(emptyState(), 1_000_000);
	assert.deepEqual(canCall(s, 1_005_000), { ok: false, reason: "intervalo", retryAt: 1_010_000 });
	assert.deepEqual(canCall(s, 1_010_000), { ok: true });
	s = recordCall(s, 1_010_000);
	assert.equal(s.calls.length, 2);
});

test("no máximo 20 chamadas por hora", () => {
	let s = emptyState();
	for (let i = 0; i < MAX_PER_HOUR; i++) s = recordCall(s, i * 60_000);
	const d = canCall(s, 20 * 60_000);
	assert.equal(d.ok, false);
	assert.equal(!d.ok && d.reason, "hora");
	assert.equal(canCall(s, 61 * 60_000).ok, true); // a 1ª saiu da janela
});

test("pausa e cooldown do botão manual", () => {
	const p = pause(emptyState(), 0);
	assert.equal(canCall(p, 10 * 60_000).ok, false);
	assert.equal(canCall(p, 15 * 60_000).ok, true);
	const m = recordCall(emptyState(), 0, true);
	assert.equal(canCall(m, 5 * 60_000, true).ok, false);
	assert.equal(canCall(m, 5 * 60_000, false).ok, true); // automático segue permitido
	assert.equal(canCall(m, 15 * 60_000, true).ok, true);
});

test("uso informado pela Meta: maior % entre os headers", () => {
	assert.equal(usagePct({}), 0);
	assert.equal(
		usagePct({
			businessUseCase: {
				"123": [{ call_count: 12, total_cputime: 3, total_time: 61, type: "ads_insights" }],
			},
		}),
		61,
	);
	assert.equal(usagePct({ insights: { acc_id_util_pct: 55, app_id_util_pct: 0.01 } }), 55);
});
