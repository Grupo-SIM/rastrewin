import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, rateLimitKey } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);

test("clientIp: prioridade cf-connecting-ip → x-real-ip → x-forwarded-for", () => {
  assert.equal(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "1.1.1.1");
  assert.equal(clientIp(h({ "x-real-ip": "3.3.3.3", "x-forwarded-for": "2.2.2.2" })), "3.3.3.3");
  assert.equal(clientIp(h({ "x-forwarded-for": "lixo, 200.147.67.142, 10.0.0.1" })), "200.147.67.142");
});

test("clientIp: IPv6, porta e IPv4 mapeado", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "2804:14c::1" })), "2804:14c::1");
  assert.equal(clientIp(h({ "x-forwarded-for": "[2804:14c::1]:443" })), "2804:14c::1");
  assert.equal(clientIp(h({ "x-forwarded-for": "177.71.207.1:5050" })), "177.71.207.1");
  assert.equal(clientIp(h({ "x-forwarded-for": "::ffff:177.71.207.1" })), "177.71.207.1");
  assert.equal(clientIp(h({})), null);
});

test("rateLimitKey usa o ÚLTIMO IP (o que o proxy anexou), não o forjável", () => {
  assert.equal(rateLimitKey(h({ "x-forwarded-for": "9.9.9.9, 177.71.207.1" })), "177.71.207.1");
  assert.equal(rateLimitKey(h({})), "unknown");
});
