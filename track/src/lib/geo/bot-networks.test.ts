import assert from "node:assert/strict";
import { test } from "node:test";
import { botNetworkName, botNetworkOf } from "./bot-networks";

test("redes de robôs: Meta e Google são reconhecidas; redes comuns e ASN ausente, não", () => {
	assert.equal(botNetworkName(32934), "Meta");
	assert.equal(botNetworkName(15169), "Google");
	assert.equal(botNetworkName(28573), null); // Claro (operadora brasileira)
	assert.equal(botNetworkName(7018), null); // AT&T (residencial nos EUA)
	assert.equal(botNetworkName(null), null);
	assert.equal(botNetworkName(undefined), null);
	assert.equal(botNetworkName(0), null);
});

test("nuvem e hospedagem são ignoradas; separadas dos robôs que executam a página", () => {
	assert.deepEqual(botNetworkOf(16509), { kind: "nuvem", name: "Amazon AWS" });
	assert.deepEqual(botNetworkOf(132203), { kind: "nuvem", name: "Tencent Cloud" });
	assert.deepEqual(botNetworkOf(32934), { kind: "robo", name: "Meta" });
});

test("operadoras brasileiras e redes do iCloud Private Relay nunca são filtradas", () => {
	for (const asn of [
		28573, // Claro
		26599, // Vivo (Telefônica)
		26615, // TIM
		18881, // Vivo fixo
		8167, // Oi/V.tal
		13335, // Cloudflare (iCloud Private Relay, WARP)
		36183, // Akamai CDN (iCloud Private Relay)
		54113, // Fastly (iCloud Private Relay)
		4837, // China Unicom (residencial; os robôs de lá caem pelo navegador antigo)
	])
		assert.equal(botNetworkOf(asn), null, `ASN ${asn}`);
});
