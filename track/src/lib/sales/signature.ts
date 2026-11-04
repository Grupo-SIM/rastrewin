import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura do SimIntPay: header `x-simintpay-signature` = HMAC-SHA256 (hex) do corpo BRUTO,
 * com o segredo do webhook. Comparação em tempo constante.
 */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(rawBody: string, header: string | null | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const received = header.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = Buffer.from(signBody(rawBody, secret), "hex");
  const given = Buffer.from(received, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
