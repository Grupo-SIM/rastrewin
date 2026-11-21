import assert from "node:assert/strict";
import { test } from "node:test";
import {
	affiliateOf,
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

test("afiliado: o evento da SimIntPay é a fonte da verdade (código, comissão em reais e nome)", () => {
	const f = toPurchaseFields(
		salesEventSchema.parse({
			...payload,
			affiliate: { code: "Joao-9", commissionCents: 540, name: " João Silva " },
			// a reserva do tracking não pode vencer o evento
			tracking: { ...payload.tracking, aff: "OUTRO-1" },
		}),
	);
	assert.deepEqual(f.affiliate, {
		authoritative: true,
		value: { code: "Joao-9", commission: "5.40", name: "João Silva" },
	});
	// comissão zero é uma comissão informada (afiliado sem comissão nesta venda), não ausência
	const zero = affiliateOf(
		salesEventSchema.parse({ ...payload, affiliate: { code: "abc", commissionCents: 0 } }),
	);
	assert.equal(zero?.value.commission, "0.00");
	assert.equal(zero?.value.name, null);
});

test("afiliado: sem o campo, tracking.aff vale só como reserva do código, sem comissão", () => {
	const f = toPurchaseFields(
		salesEventSchema.parse({ ...payload, tracking: { ...payload.tracking, aff: "RESERVA_1" } }),
	);
	assert.deepEqual(f.affiliate, {
		authoritative: false,
		value: { code: "RESERVA_1", commission: null, name: null },
	});
	assert.equal(toPurchaseFields(salesEventSchema.parse({ ...payload, affiliate: null })).affiliate, null);
	assert.equal(toPurchaseFields(salesEventSchema.parse(payload)).affiliate, null);
	// reserva fora do formato é descartada
	for (const bad of ["ab", "a b", "x".repeat(41), "<b>"])
		assert.equal(
			toPurchaseFields(salesEventSchema.parse({ ...payload, tracking: { aff: bad } })).affiliate,
			null,
			bad,
		);
});

test("afiliado malformado no evento não derruba a venda: é ignorado (vale a reserva, sem comissão)", () => {
	for (const affiliate of [
		{ code: "x", commissionCents: 100 },
		{ code: "abc", commissionCents: -1 },
		{ code: "abc" },
		"abc",
	]) {
		const parsed = salesEventSchema.safeParse({ ...payload, affiliate, tracking: { aff: "RESERVA_1" } });
		assert.equal(parsed.success, true);
		const f = toPurchaseFields(parsed.data!);
		assert.equal(f.affiliate?.authoritative, false);
		assert.equal(f.affiliate?.value.commission, null);
	}
});

test("afiliado fica fixo depois da aprovação: reembolso/chargeback não regravam (postApprovalOnly)", () => {
	const approved = new Date("2026-11-05T12:00:00Z");
	// um chargeback que traga outro afiliado cai no ramo que só muda status e data
	const refund = salesEventSchema.parse({
		...payload,
		affiliate: { code: "TROCADO", commissionCents: 1 },
		event: "chargeback",
	});
	assert.equal(postApprovalOnly(approved, toPurchaseFields(refund).status), true);
	// nova aprovação do mesmo pedido é a única que pode atualizar afiliado e comissão
	assert.equal(postApprovalOnly(approved, toPurchaseFields(salesEventSchema.parse(payload)).status), false);
});
