import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "@/lib/tracking/normalize";
import { buildEvent, buildUserData } from "./capi";

test("user_data: hash nos dados pessoais, SEM hash em fbp/fbc/IP/UA", () => {
  const ud = buildUserData({
    externalId: "abc123def456ghi7",
    email: " Ana@Exemplo.com ",
    phone: "(11) 99999-8888",
    firstName: "Ana",
    lastName: "Silva",
    city: "São Paulo",
    region: "SP",
    country: "BR",
    ip: "177.71.207.1",
    userAgent: "Mozilla/5.0",
    fbp: "fb.1.1730000000000.1234567890",
    fbc: "fb.1.1730000000000.AbCdEf",
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
  const ud = buildUserData({ externalId: "abc123def456ghi7", emHash: h });
  assert.deepEqual(ud.em, [h]);
  assert.deepEqual(Object.keys(ud).sort(), ["em", "external_id"]);
});

test("evento: action_source website, event_time em segundos, event_id e URL", () => {
  const e = buildEvent({
    eventName: "Lead",
    eventId: "evt-12345678",
    eventTime: new Date("2026-11-02T12:00:00Z"),
    eventSourceUrl: "https://meusite.com.br/",
    person: { externalId: "abc123def456ghi7" },
    customData: { value: 10, currency: "BRL" },
  });
  assert.equal(e.action_source, "website");
  assert.equal(e.event_time, 1793620800);
  assert.equal(e.event_id, "evt-12345678");
  assert.equal(e.event_source_url, "https://meusite.com.br/");
  assert.deepEqual(e.custom_data, { value: 10, currency: "BRL" });
});
