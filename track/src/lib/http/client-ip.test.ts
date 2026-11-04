import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, ipSource, rateLimitKey } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);

test("clientIp: x-real-ip (do proxy) → último IP do x-forwarded-for", () => {
  assert.equal(clientIp(h({ "x-real-ip": "3.3.3.3", "x-forwarded-for": "2.2.2.2" })), "3.3.3.3");
  assert.equal(clientIp(h({ "x-forwarded-for": "9.9.9.9, 200.147.67.142" })), "200.147.67.142");
  assert.equal(clientIp(h({ "x-real-ip": "lixo", "x-forwarded-for": "200.147.67.142" })), "200.147.67.142");
});

test("cabeçalhos forjáveis pelo cliente são ignorados", () => {
  // Sem Cloudflare, qualquer um envia cf-connecting-ip: não pode mudar o IP nem a chave do rate limit.
  assert.equal(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "177.71.207.1" })), "177.71.207.1");
  assert.equal(rateLimitKey(h({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "177.71.207.1" })), "177.71.207.1");
  assert.equal(rateLimitKey(h({ "cf-connecting-ip": "1.1.1.1" })), "unknown");
  assert.equal(rateLimitKey(h({ "true-client-ip": "1.1.1.1", "x-forwarded-for": "8.8.8.8, 177.71.207.1" })), "177.71.207.1");
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

test("ipSource diz de onde veio o IP (diagnóstico do proxy)", () => {
  assert.equal(ipSource(h({ "x-real-ip": "177.71.207.1" })), "x-real-ip");
  assert.equal(ipSource(h({ "x-forwarded-for": "177.71.207.1" })), "x-forwarded-for");
  assert.equal(ipSource(h({ "cf-connecting-ip": "1.1.1.1" })), null);
});
