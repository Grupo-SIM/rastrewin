import assert from "node:assert/strict";
import { test } from "node:test";
import { botNetworkName } from "./bot-networks";

test("redes de robôs: Meta e Google são reconhecidas; redes comuns e ASN ausente, não", () => {
	assert.equal(botNetworkName(32934), "Meta");
	assert.equal(botNetworkName(15169), "Google");
	assert.equal(botNetworkName(28573), null); // Claro (operadora brasileira)
	assert.equal(botNetworkName(7018), null); // AT&T (residencial nos EUA)
	assert.equal(botNetworkName(null), null);
	assert.equal(botNetworkName(undefined), null);
	assert.equal(botNetworkName(0), null);
});
