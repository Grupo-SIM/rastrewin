import assert from "node:assert/strict";
import { test } from "node:test";
import { eventSchema, identifySchema } from "./schemas";

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
