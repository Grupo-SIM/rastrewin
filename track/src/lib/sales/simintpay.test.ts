import assert from "node:assert/strict";
import { test } from "node:test";
import {
	isRefunded,
	isSaleActive,
	mapStatus,
	nextStatus,
	salesEventSchema,
	toPurchaseFields,
} from "./simintpay";

// Exemplo baseado no teste do próprio SimIntPay (platform-sales-events.service.test.ts)
const payload = {
	amountCents: 2700,
	campoNovoQualquer: 1,
	customerEmail: "maria@example.com",
	customerName: "Maria",
	event: "purchase_approved",
	eventId: "4f1c0d2e9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d",
	items: [
		{ tipo: "PRINCIPAL", titulo: "Livro", valor: 27 },
		{ offerId: "bump1", tipo: "ORDER_BUMP", titulo: "Bônus", valor: 10 },
	],
	linkId: "link",
	netAmountCents: 2400,
	occurredAt: "2026-11-02T15:00:00.000Z",
	orderId: "tx_123",
	paymentMethod: "PIX",
	phone: "5511999999999",
	tracking: { fbc: "fb.1.1730000000000.AbC", fbp: "lixo", src: "abc123def456ghi7", utm_content: "A1" },
};

test("payload real do SimIntPay é aceito (campos novos passam)", () => {
	assert.equal(salesEventSchema.safeParse(payload).success, true);
	assert.equal(salesEventSchema.safeParse({ ...payload, event: "outro" }).success, false);
	assert.equal(salesEventSchema.safeParse({ ...payload, amountCents: -1 }).success, false);
});

test("centavos → reais, produto principal, tracking e src", () => {
	const f = toPurchaseFields(salesEventSchema.parse(payload));
	assert.equal(f.value, "27.00");
	assert.equal(f.netValue, "24.00");
	assert.equal(f.product, "Livro");
	assert.equal(f.status, "approved");
	assert.equal(f.trckUserIdFromSrc, "abc123def456ghi7");
	assert.equal(f.utm.utmContent, "A1");
	assert.equal(f.hasUtm, true);
	assert.equal(f.fbc, "fb.1.1730000000000.AbC");
	assert.equal(f.fbp, null); // formato inválido é descartado
	assert.deepEqual(
		f.items.map(i => i.id),
		["Livro", "bump1"],
	);
});

test("src que não é trck_user_id não é usado para ligar a venda", () => {
	const f = toPurchaseFields(salesEventSchema.parse({ ...payload, tracking: { src: "afiliado x!" } }));
	assert.equal(f.src, "afiliado x!");
	assert.equal(f.trckUserIdFromSrc, null);
});

test("status: mapeamento e precedência (evento atrasado não desfaz reembolso)", () => {
	assert.equal(mapStatus("pix_generated"), "pending");
	assert.equal(mapStatus("card_declined"), "declined");
	assert.equal(nextStatus(null, "pending"), "pending");
	assert.equal(nextStatus("pending", "approved"), "approved");
	assert.equal(nextStatus("approved", "refunded"), "refunded");
	assert.equal(nextStatus("refunded", "approved"), "refunded");
	assert.equal(nextStatus("approved", "pending"), "approved");
	assert.equal(nextStatus("refund_requested", "approved"), "approved"); // mediação resolvida
	assert.equal(isSaleActive("approved"), true);
	assert.equal(isRefunded("chargeback"), true);
});
