import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateTime, isValidTimeZone } from "./time";

test("formata no fuso configurado (Acre é 2 h atrás de Brasília)", () => {
  const iso = "2026-11-02T19:25:00Z";
  assert.equal(formatDateTime(iso, "America/Sao_Paulo"), "02/11/2026, 16:25");
  assert.equal(formatDateTime(iso, "America/Rio_Branco"), "02/11/2026, 14:25");
});

test("valida fusos IANA", () => {
  assert.equal(isValidTimeZone("America/Rio_Branco"), true);
  assert.equal(isValidTimeZone("Brasil/Acre-errado"), false);
});
