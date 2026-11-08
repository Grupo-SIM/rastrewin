import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEventTypes, serializeEventTypes } from "./event-types";

describe("parseEventTypes", () => {
	it("vazio = todos os tipos", () => {
		assert.deepEqual(parseEventTypes(null), []);
		assert.deepEqual(parseEventTypes(""), []);
		assert.deepEqual(parseEventTypes(" , "), []);
	});

	it("link antigo com um tipo só continua valendo", () => {
		assert.deepEqual(parseEventTypes("PageView"), ["PageView"]);
	});

	it("vários tipos, sem espaços e sem repetição", () => {
		assert.deepEqual(parseEventTypes("PageView, InitiateCheckout,PageView"), [
			"PageView",
			"InitiateCheckout",
		]);
	});

	it("descarta o que não é nome de evento", () => {
		assert.deepEqual(parseEventTypes("PageView,'; drop table x,1abc,Lead"), ["PageView", "Lead"]);
		assert.deepEqual(parseEventTypes("a".repeat(41)), []);
	});

	it("limita a 30 tipos", () => {
		const many = Array.from({ length: 40 }, (_, i) => `E${i}`).join(",");
		assert.equal(parseEventTypes(many).length, 30);
	});
});

describe("serializeEventTypes", () => {
	it("nenhum tipo = sem parâmetro", () => {
		assert.equal(serializeEventTypes([]), null);
	});

	it("junta por vírgula", () => {
		assert.equal(serializeEventTypes(["PageView", "Lead"]), "PageView,Lead");
	});
});
