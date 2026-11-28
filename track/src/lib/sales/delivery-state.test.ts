import assert from "node:assert/strict";
import { test } from "node:test";
import { canResend, type DeliveryInput, deliveryState, deliveryText, whenText } from "./delivery-state";

const TZ = "America/Sao_Paulo";
const sale = new Date("2026-11-28T12:12:00Z"); // 09:12 em Brasília
const HOUR = 3_600_000;
const base: DeliveryInput = {
	active: true,
	attempts: 0,
	consent: true,
	destination: "meta",
	hasAccount: true,
	isRenewal: false,
	isTest: false,
	now: new Date(sale.getTime() + 3 * HOUR),
	saleAt: sale,
	sentAt: null,
};

test("venda já enviada, renovação, sem consentimento, teste e não aprovada não entram no reenvio", () => {
	assert.equal(deliveryState({ ...base, sentAt: sale }).kind, "enviado");
	assert.equal(deliveryState({ ...base, isRenewal: true }).kind, "renovacao");
	assert.equal(deliveryState({ ...base, consent: false }).kind, "sem-consentimento");
	assert.equal(deliveryState({ ...base, isTest: true }).kind, "teste");
	assert.equal(deliveryState({ ...base, active: false }).kind, "inativa");
});

test("pane de horas: 6 tentativas feitas, a próxima é às +4 h e dá para reenviar na hora", () => {
	const s = deliveryState({ ...base, attempts: 6 });
	assert.deepEqual(s, {
		attempts: 6,
		kind: "tentando",
		nextAt: new Date(sale.getTime() + 4 * HOUR).toISOString(),
	});
	assert.equal(canResend(s, true), true);
	assert.equal(
		deliveryText(s, "meta", base.now, TZ),
		"Não enviado · 6 tentativas · próxima às 13:12, automática",
	);
});

test("Meta desiste depois de 7 dias (sem botão); esgotar tentativas antes disso ainda deixa reenviar", () => {
	const late = deliveryState({ ...base, attempts: 21, now: new Date(sale.getTime() + 170 * HOUR) });
	assert.deepEqual(late, { attempts: 21, kind: "desistiu", reason: "prazo" });
	assert.equal(canResend(late, true), false);
	assert.match(deliveryText(late, "meta", base.now, TZ), /mais de 7 dias/);

	const ga4 = deliveryState({
		...base,
		attempts: 21,
		destination: "ga4",
		now: new Date(sale.getTime() + 170 * HOUR),
	});
	assert.deepEqual(ga4, { attempts: 21, kind: "desistiu", reason: "tentativas" });
	assert.equal(canResend(ga4, true), true);
});

test("sem pixel ativo e sem tentativa: avisa em vez de prometer reenvio", () => {
	const s = deliveryState({ ...base, hasAccount: false });
	assert.equal(s.kind, "sem-conta");
	assert.equal(canResend(s, false), false);
	assert.equal(canResend(deliveryState({ ...base, attempts: 3 }), false), false);
});

test("hora da próxima tentativa no fuso do painel", () => {
	const now = new Date("2026-11-28T15:00:00Z"); // 12:00 em Brasília
	assert.equal(whenText("2026-11-28T16:12:00Z", now, TZ), "às 13:12");
	assert.equal(whenText("2026-11-29T04:12:00Z", now, TZ), "em 29/11 às 01:12");
	assert.equal(whenText("2026-11-28T14:00:00Z", now, TZ), "em instantes");
	const first = deliveryState({ ...base, now: sale });
	assert.equal(deliveryText(first, "meta", now, TZ), "Não enviado · 1ª tentativa em instantes, automática");
});
