import assert from "node:assert/strict";
import { test } from "node:test";
import { BANNER_REJECTED_REASON, isBannerRejected } from "./consent";

test("isBannerRejected: só a recusa explícita do banner", () => {
	// marca nova
	assert.equal(
		isBannerRejected({ by: null, consent: "rejected", found: false, reason: BANNER_REJECTED_REASON }),
		true,
	);
	// venda gravada antes da marca (só o motivo)
	assert.equal(isBannerRejected({ by: null, found: false, reason: BANNER_REJECTED_REASON }), true);
	// banner sem resposta: venda não ligada, sem recusa
	assert.equal(
		isBannerRejected({
			by: null,
			found: false,
			reason: "sem src no checkout e email/telefone não bateram",
		}),
		false,
	);
	// venda ligada a quem aceitou
	assert.equal(
		isBannerRejected({ by: "trck_user_id", found: true, reason: "src do checkout = trck_user_id" }),
		false,
	);
	// sem match (ex.: anonimizada por pedido de exclusão)
	assert.equal(isBannerRejected(null), false);
	assert.equal(isBannerRejected(undefined), false);
	assert.equal(isBannerRejected("rejected"), false);
	assert.equal(isBannerRejected({ consent: "granted" }), false);
});
