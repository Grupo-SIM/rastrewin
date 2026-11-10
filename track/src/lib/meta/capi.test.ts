import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "@/lib/tracking/normalize";
import { buildEvent, buildUserData, fbcFromFbclid } from "./capi";

test("user_data: hash nos dados pessoais, SEM hash em fbp/fbc/IP/UA", () => {
	const ud = buildUserData({
		city: "São Paulo",
		country: "BR",
		email: " Ana@Exemplo.com ",
		externalId: "abc123def456ghi7",
		fbc: "fb.1.1730000000000.AbCdEf",
		fbp: "fb.1.1730000000000.1234567890",
		firstName: "Ana",
		ip: "177.71.207.1",
		lastName: "Silva",
		phone: "(11) 99999-8888",
		region: "SP",
		userAgent: "Mozilla/5.0",
	});
	assert.deepEqual(ud.em, [sha256("ana@exemplo.com")]);
	assert.deepEqual(ud.ph, [sha256("5511999998888")]);
	assert.deepEqual(ud.fn, [sha256("ana")]);
	assert.deepEqual(ud.ln, [sha256("silva")]);
	assert.deepEqual(ud.ct, [sha256("saopaulo")]);
	assert.deepEqual(ud.st, [sha256("sp")]);
	assert.deepEqual(ud.country, [sha256("br")]);
	assert.deepEqual(ud.external_id, [sha256("abc123def456ghi7")]);
	assert.equal(ud.client_ip_address, "177.71.207.1");
	assert.equal(ud.client_user_agent, "Mozilla/5.0");
	assert.equal(ud.fbp, "fb.1.1730000000000.1234567890");
	assert.equal(ud.fbc, "fb.1.1730000000000.AbCdEf");
});

test("user_data: campos ausentes não aparecem; hash pronto é reaproveitado", () => {
	const h = sha256("x@y.com");
	const ud = buildUserData({ emHash: h, externalId: "abc123def456ghi7" });
	assert.deepEqual(ud.em, [h]);
	assert.deepEqual(Object.keys(ud).sort(), ["em", "external_id"]);
});

test("evento: action_source website, event_time em segundos, event_id e URL", () => {
	const e = buildEvent({
		customData: { currency: "BRL", value: 10 },
		eventId: "evt-12345678",
		eventName: "Lead",
		eventSourceUrl: "https://meusite.com.br/",
		eventTime: new Date("2026-11-02T12:00:00Z"),
		person: { externalId: "abc123def456ghi7" },
	});
	assert.equal(e.action_source, "website");
	assert.equal(e.event_time, 1793620800);
	assert.equal(e.event_id, "evt-12345678");
	assert.equal(e.event_source_url, "https://meusite.com.br/");
	assert.deepEqual(e.custom_data, { currency: "BRL", value: 10 });
});

test("fbc a partir do fbclid: formato da Meta, maiúsculas preservadas, inválido = null", () => {
	const at = new Date("2026-11-02T12:00:00.123Z");
	assert.equal(fbcFromFbclid("IwAR2xYz_Ab-Cd", at), `fb.1.${at.getTime()}.IwAR2xYz_Ab-Cd`);
	assert.equal(fbcFromFbclid(null, at), null);
	assert.equal(fbcFromFbclid("com espaço", at), null);
});
