import assert from "node:assert/strict";
import { test } from "node:test";
import { consentSchema, eventSchema, identifySchema } from "./schemas";

const base = {
	event_id: "0f8e2a1c-1234-4cde-9abc-1234567890ab",
	event_name: "Lead",
	event_source_url: "https://meusite.com.br/obrigado",
	trck_user_id: "abc123def456ghi7",
};

test("evento válido passa", () => {
	assert.equal(eventSchema.safeParse(base).success, true);
});

test("Purchase é recusado (só vem do webhook)", () => {
	assert.equal(eventSchema.safeParse({ ...base, event_name: "Purchase" }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, event_name: "purchase" }).success, false);
});

test("campos estranhos ou fora do formato são recusados", () => {
	assert.equal(eventSchema.safeParse({ ...base, event_name: "<script>" }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, trck_user_id: "x" }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, event_source_url: "javascript:alert(1)" }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, fbp: "nao-e-fbp" }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, custom_data: { value: -1 } }).success, false);
	assert.equal(eventSchema.safeParse({ ...base, custom_data: { hack: 1 } }).success, false);
});

test("identify aceita vazio (o servidor gera o id) e normaliza vazios para null", () => {
	const r = identifySchema.safeParse({ utm_source: "" });
	assert.equal(r.success, true);
	assert.equal(r.success && r.data.utm_source, null);
});

test("evento aceita as UTMs (opcionais) com os mesmos limites do identify", () => {
	const ok = eventSchema.safeParse({
		...base,
		utm_campaign: "VSL Nov|120200000000001",
		utm_source: "facebook",
	});
	assert.equal(ok.success, true);
	assert.equal(ok.success && ok.data.utm_source, "facebook");
	assert.equal(eventSchema.safeParse({ ...base, utm_source: "x".repeat(201) }).success, false);
	// t.js antigo, sem UTMs no evento, continua válido
	assert.equal(eventSchema.safeParse(base).success, true);
});

test("afiliado (aff) é opcional e só aceita o formato do código", () => {
	assert.equal(eventSchema.safeParse(base).success, true); // t.js antigo, sem aff
	const ok = eventSchema.safeParse({ ...base, aff: "  Joao_Silva-9 " });
	assert.equal(ok.success && ok.data.aff, "Joao_Silva-9");
	assert.equal(identifySchema.safeParse({ aff: "abc" }).success, true);
	assert.equal(identifySchema.safeParse({ aff: null }).success && true, true);
	for (const bad of ["ab", "x".repeat(41), "a b c", "a/b", "<script>", "joão", "a@b.com", ""]) {
		assert.equal(eventSchema.safeParse({ ...base, aff: bad }).success, false, bad);
		assert.equal(identifySchema.safeParse({ aff: bad }).success, false, bad);
	}
	const none = identifySchema.safeParse({});
	assert.equal(none.success && none.data.aff, null);
});

const choice = {
	consent_id: "c0ns3nt1d2345678",
	page_url: "https://rastrewin.com/",
	version: "1",
};

test("consentimento: aceite com visitante e recusa sem visitante passam", () => {
	assert.equal(
		consentSchema.safeParse({
			...choice,
			action: "accept_all",
			marketing: true,
			trck_user_id: base.trck_user_id,
		}).success,
		true,
	);
	assert.equal(
		consentSchema.safeParse({ ...choice, action: "reject_all", marketing: false }).success,
		true,
	);
	assert.equal(
		consentSchema.safeParse({
			...choice,
			action: "revoke",
			marketing: false,
			trck_user_id: base.trck_user_id,
		}).success,
		true,
	);
});

test("consentimento: escolha incoerente ou recusa com visitante é recusada", () => {
	assert.equal(
		consentSchema.safeParse({ ...choice, action: "accept_all", marketing: false }).success,
		false,
	);
	assert.equal(
		consentSchema.safeParse({ ...choice, action: "reject_all", marketing: true }).success,
		false,
	);
	assert.equal(
		consentSchema.safeParse({
			...choice,
			action: "reject_all",
			marketing: false,
			trck_user_id: base.trck_user_id,
		}).success,
		false,
	);
});

test("captura sem o campo consent continua válida (a rota é que ignora)", () => {
	const parsed = eventSchema.safeParse(base);
	assert.equal(parsed.success, true);
	assert.equal(parsed.success && parsed.data.consent, undefined);
	assert.equal(eventSchema.safeParse({ ...base, consent: "1" }).success, true);
});
