import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addPaymentInfoSkipReason,
	isRefunded,
	isSaleActive,
	mapStatus,
	nextStatus,
	postApprovalOnly,
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

test("renovação: só com renewal === true (o contrato do SimIntPay não traz o campo)", () => {
	assert.equal(toPurchaseFields(salesEventSchema.parse(payload)).isRenewal, false);
	assert.equal(toPurchaseFields(salesEventSchema.parse({ ...payload, renewal: true })).isRenewal, true);
	assert.equal(toPurchaseFields(salesEventSchema.parse({ ...payload, renewal: null })).isRenewal, false);
	assert.equal(salesEventSchema.safeParse({ ...payload, renewal: "sim" }).success, false);
});

test("recusa do banner (tracking.consent = rejected): nada liga a venda ao visitante", () => {
	const recusa = toPurchaseFields(
		salesEventSchema.parse({ ...payload, tracking: { ...payload.tracking, consent: "rejected" } }),
	);
	assert.equal(recusa.consentRejected, true);
	assert.equal(recusa.trckUserIdFromSrc, null);
	assert.equal(recusa.fbc, null);
	assert.equal(recusa.fbclid, null);
	assert.equal(recusa.fbp, null);
	for (const consent of ["granted", "", "REJECTED"]) {
		const f = toPurchaseFields(
			salesEventSchema.parse({ ...payload, tracking: { ...payload.tracking, consent } }),
		);
		assert.equal(f.consentRejected, false, consent);
		assert.equal(f.trckUserIdFromSrc, "abc123def456ghi7");
	}
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

test("postApprovalOnly: depois da aprovação, só uma nova aprovação muda os dados da venda", () => {
	const approved = new Date("2026-11-05T12:00:00Z");
	// já aprovada: reembolso, chargeback, pedido de reembolso e PIX não regravam valor/UTM
	for (const s of ["refunded", "chargeback", "refund_requested", "pending", "declined", "expired"] as const)
		assert.equal(postApprovalOnly(approved, s), true, s);
	// nova aprovação do mesmo pedido continua podendo atualizar
	assert.equal(postApprovalOnly(approved, "approved"), false);
	// antes da aprovação (PIX gerado → aprovado) os dados seguem sendo preenchidos
	assert.equal(postApprovalOnly(null, "pending"), false);
	assert.equal(postApprovalOnly(undefined, "refunded"), false);
});

test("AddPaymentInfo: Pix gerado ou cartão recusado, uma vez por pedido, só com aceite e fora de renovação", () => {
	const now = new Date("2026-11-16T12:00:00Z");
	const ok = {
		event: "pix_generated" as const,
		isRenewal: false,
		marketingConsent: true,
		now,
		occurredAt: new Date("2026-11-16T11:59:00Z"),
		status: "pending",
		trckUserId: "abc123def456ghi7",
	};
	assert.equal(addPaymentInfoSkipReason(ok), null);
	assert.equal(addPaymentInfoSkipReason({ ...ok, event: "card_declined", status: "declined" }), null);
	// outros avisos não geram AddPaymentInfo
	for (const event of ["pix_expired", "purchase_refunded", "chargeback", "refund_requested"] as const)
		assert.notEqual(addPaymentInfoSkipReason({ ...ok, event }), null, event);
	// Pix gerado depois de a venda já estar aprovada ou reembolsada (aviso atrasado): não envia
	for (const status of ["approved", "refund_requested", "refunded", "chargeback"])
		assert.equal(addPaymentInfoSkipReason({ ...ok, status }), "pedido já aprovado ou encerrado", status);
	assert.equal(addPaymentInfoSkipReason({ ...ok, isRenewal: true }), "renovação");
	// LGPD: sem aceite (ou recusa do banner, que deixa a venda sem visitante) não envia
	assert.equal(addPaymentInfoSkipReason({ ...ok, marketingConsent: false }), "sem consentimento");
	assert.equal(addPaymentInfoSkipReason({ ...ok, marketingConsent: null }), "sem consentimento");
	assert.equal(addPaymentInfoSkipReason({ ...ok, trckUserId: null }), "sem consentimento");
	assert.equal(
		addPaymentInfoSkipReason({ ...ok, occurredAt: new Date("2026-11-08T11:00:00Z") }),
		"fora do prazo",
	);
});

test("plano do cadastro vira o id do item principal (mesmo content_id do InitiateCheckout)", () => {
	const semPlano = toPurchaseFields(salesEventSchema.parse(payload));
	assert.deepEqual(
		semPlano.items.map(i => i.id),
		["Livro", "bump1"],
	);
	const comPlano = toPurchaseFields(salesEventSchema.parse({ ...payload, plan: "pro" }));
	assert.deepEqual(
		comPlano.items.map(i => [i.id, i.name]),
		[
			["pro", "Livro"],
			["bump1", "Bônus"],
		],
	);
	// sem itens no aviso: um item só, com o plano e o valor da venda
	const semItens = toPurchaseFields(salesEventSchema.parse({ ...payload, items: null, plan: "vip" }));
	assert.deepEqual(semItens.items, [{ id: "vip", name: "Produto", price: 27, type: null }]);
	// plano inválido é ignorado, sem derrubar o aviso
	const invalido = salesEventSchema.parse({ ...payload, plan: "Plano X!" });
	assert.equal(invalido.plan, null);
	assert.equal(toPurchaseFields(invalido).items[0].id, "Livro");
});

test("AddPaymentInfo na aprovação: cartão de primeira (ou Pix fora de ordem), com a venda ativa", () => {
	const now = new Date("2026-11-16T12:00:00Z");
	const aprovado = {
		event: "purchase_approved" as const,
		isRenewal: false,
		marketingConsent: true,
		now,
		occurredAt: new Date("2026-11-16T11:59:59Z"),
		status: "approved",
		trckUserId: "abc123def456ghi7",
	};
	assert.equal(addPaymentInfoSkipReason(aprovado), null);
	assert.equal(addPaymentInfoSkipReason({ ...aprovado, status: "refund_requested" }), null);
	// aprovação que chega com a venda já reembolsada (reentrega atrasada): não envia
	for (const status of ["refunded", "chargeback", "pending", "declined"])
		assert.equal(addPaymentInfoSkipReason({ ...aprovado, status }), "venda não está ativa", status);
	// mesmas regras do Pix: renovação, sem aceite, fora do prazo
	assert.equal(addPaymentInfoSkipReason({ ...aprovado, isRenewal: true }), "renovação");
	assert.equal(addPaymentInfoSkipReason({ ...aprovado, marketingConsent: false }), "sem consentimento");
	assert.equal(
		addPaymentInfoSkipReason({ ...aprovado, occurredAt: new Date("2026-11-08T11:00:00Z") }),
		"fora do prazo",
	);
});
