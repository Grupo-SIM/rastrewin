import assert from "node:assert/strict";
import { test } from "node:test";
import { HIDDEN, maskEmail, maskIp, maskName, maskPhone, redactPersonal } from "./mask";

test("maskName: 1ª letra de cada palavra", () => {
	assert.equal(maskName("Marina Alves"), "M***** A****");
	assert.equal(maskName("  José   da Silva "), "J*** d* S****");
	assert.equal(maskName("Ana"), "A**");
	assert.equal(maskName("X"), "X*");
	assert.equal(maskName(""), "");
	assert.equal(maskName(null), null);
	assert.equal(maskName(undefined), null);
});

test("maskEmail: 1ª letra + domínio", () => {
	assert.equal(maskEmail("marina.alves@gmail.com"), "m***@gmail.com");
	assert.equal(maskEmail("A@b.co"), "A***@b.co");
	assert.equal(maskEmail("semarroba"), "s***");
	assert.equal(maskEmail("fim@"), "f***");
	assert.equal(maskEmail(null), null);
	assert.ok(!maskEmail("marina.alves@gmail.com")?.includes("marina"));
});

test("maskPhone: DDD (e 55) + 2 últimos dígitos, pontuação preservada", () => {
	assert.equal(maskPhone("(11) 98765-4321"), "(11) *****-**21");
	assert.equal(maskPhone("11987654321"), "11*******21");
	assert.equal(maskPhone("+55 11 98765-4321"), "+55 11 *****-**21");
	assert.equal(maskPhone("5511987654321"), "5511*******21");
	assert.equal(maskPhone("(55) 8765-4321"), "(55) ****-**21"); // telefone truncado "(55)+não-9" (10 dígitos)
	assert.equal(maskPhone("987654321"), "*******21"); // sem DDD: só os 2 últimos
	assert.equal(maskPhone("12"), "***");
	assert.equal(maskPhone(null), null);
	assert.ok(!maskPhone("(11) 98765-4321")?.includes("98765"));
});

test("maskIp: IPv4 e IPv6", () => {
	assert.equal(maskIp("187.45.120.33"), "187.45.*.*");
	assert.equal(maskIp("2804:14c:5b81:8f00::1"), "2804:14c:*");
	assert.equal(maskIp("::1"), HIDDEN);
	assert.equal(maskIp("lixo"), HIDDEN);
	assert.equal(maskIp(null), null);
});

test("redactPersonal: esconde identificadores da Meta/GA4 e mantém o resto", () => {
	const meta = {
		data: [
			{
				custom_data: { currency: "BRL", value: 150 },
				event_id: "purchase_abc",
				event_name: "Purchase",
				user_data: {
					client_ip_address: "187.45.120.33",
					client_user_agent: "Mozilla/5.0",
					country: ["hash-br"],
					em: ["hash-email"],
					external_id: ["hash-id"],
					fbc: "fb.1.123.abc",
					fbp: "fb.1.123.456",
					fn: ["hash-fn"],
					ln: ["hash-ln"],
					ph: ["hash-ph"],
				},
			},
		],
	};
	const out = redactPersonal(meta);
	const ud = out.data[0].user_data as Record<string, unknown>;
	for (const k of ["client_ip_address", "country", "em", "external_id", "fn", "ln", "ph"])
		assert.equal(ud[k], HIDDEN, k);
	assert.equal(ud.fbc, "fb.1.123.abc");
	assert.equal(ud.fbp, "fb.1.123.456");
	assert.equal(ud.client_user_agent, "Mozilla/5.0");
	assert.equal(out.data[0].event_name, "Purchase");
	assert.deepEqual(out.data[0].custom_data, { currency: "BRL", value: 150 });
	assert.equal(meta.data[0].user_data.em[0], "hash-email", "não altera o original");

	const ga4 = {
		client_id: "123.456",
		events: [{ name: "purchase", params: { value: 1 } }],
		ip_override: "1.2.3.4",
	};
	const g = redactPersonal(ga4);
	assert.equal(g.ip_override, HIDDEN);
	assert.equal(g.client_id, "123.456");
	assert.equal(g.events[0].name, "purchase", "nome do evento do GA4 continua visível");

	const webhook = {
		amountCents: 100,
		customer: { customerName: "Ana", Email: "a@b.com", phone: "11999999999" },
	};
	const w = redactPersonal(webhook);
	assert.deepEqual(w.customer, { customerName: HIDDEN, Email: HIDDEN, phone: HIDDEN });
	assert.equal(w.amountCents, 100);
	assert.equal(redactPersonal(null), null);
	assert.deepEqual(redactPersonal({ em: null, ip: "" }), { em: null, ip: "" });
});
