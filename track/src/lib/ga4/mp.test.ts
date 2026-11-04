import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMpBody, syntheticClientId } from "./mp";

const now = new Date("2026-11-02T18:00:00Z");

test("purchase com client_id/session_id da visita e timestamp da venda", () => {
	const body = buildMpBody({
		clientId: "123.456",
		currency: "BRL",
		items: [{ item_id: "Livro", item_name: "Livro", price: 27, quantity: 1 }],
		name: "purchase",
		now,
		occurredAt: new Date("2026-11-02T17:00:00Z"),
		sessionId: "1793600000",
		transactionId: "tx_1",
		value: 27,
	});
	assert.equal(body.client_id, "123.456");
	assert.equal(body.timestamp_micros, new Date("2026-11-02T17:00:00Z").getTime() * 1000);
	const params = body.events[0].params;
	assert.equal(body.events[0].name, "purchase");
	assert.equal(params.transaction_id, "tx_1");
	assert.equal(params.session_id, "1793600000");
	assert.equal(params.currency, "BRL");
	assert.equal(params.debug_mode, undefined);
});

test("sem visitante: client_id sintético e estável; venda antiga sem timestamp", () => {
	const a = buildMpBody({
		clientId: null,
		currency: "BRL",
		name: "purchase",
		now,
		occurredAt: new Date("2026-10-01T00:00:00Z"),
		transactionId: "tx_9",
		value: 1,
	});
	const b = buildMpBody({
		clientId: null,
		currency: "BRL",
		name: "purchase",
		now,
		transactionId: "tx_9",
		value: 1,
	});
	assert.match(a.client_id, /^\d+\.\d+$/);
	assert.equal(a.client_id, b.client_id);
	assert.equal(a.client_id, syntheticClientId("tx_9"));
	assert.equal(a.timestamp_micros, undefined); // > 72 h: o GA4 recusaria
});

test("modo debug marca debug_mode", () => {
	const body = buildMpBody({
		clientId: "1.2",
		currency: "BRL",
		debug: true,
		name: "refund",
		now,
		transactionId: "tx",
		value: 5,
	});
	assert.equal(body.events[0].name, "refund");
	assert.equal(body.events[0].params.debug_mode, 1);
});
