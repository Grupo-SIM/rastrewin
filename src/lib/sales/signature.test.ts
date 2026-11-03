import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { signBody, verifySignature } from "./signature";

const secret = "segredo-de-teste-com-mais-de-24-caracteres";
const body = JSON.stringify({ eventId: "abc", amountCents: 2700 });

test("assinatura igual à do SimIntPay (HMAC-SHA256 hex do corpo exato)", () => {
  assert.equal(signBody(body, secret), createHmac("sha256", secret).update(body).digest("hex"));
  assert.equal(verifySignature(body, signBody(body, secret), secret), true);
  assert.equal(verifySignature(body, signBody(body, secret).toUpperCase(), secret), true);
});

test("corpo adulterado, segredo errado ou header inválido são recusados", () => {
  const sig = signBody(body, secret);
  assert.equal(verifySignature(body.replace("2700", "1"), sig, secret), false);
  assert.equal(verifySignature(body, sig, "outro-segredo-qualquer-123456"), false);
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, "", secret), false);
  assert.equal(verifySignature(body, "zz".repeat(32), secret), false);
  assert.equal(verifySignature(body, sig.slice(0, 40), secret), false);
});
