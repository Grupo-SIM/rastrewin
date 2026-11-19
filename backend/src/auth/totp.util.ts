import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* TOTP (RFC 6238): SHA-1, 6 dígitos, passo de 30 s. É o que o Google Authenticator, o Authy e o 1Password geram. */

const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret() {
	const bytes = randomBytes(20);
	let bits = "";
	for (const b of bytes) bits += b.toString(2).padStart(8, "0");
	let out = "";
	for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[Number.parseInt(bits.slice(i, i + 5), 2)];
	return out;
}

function decodeBase32(value: string) {
	let bits = "";
	for (const c of value.toUpperCase().replace(/=+$/, "")) {
		const i = ALPHABET.indexOf(c);
		if (i < 0) throw new Error("segredo inválido");
		bits += i.toString(2).padStart(5, "0");
	}
	const bytes: number[] = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
	return Buffer.from(bytes);
}

function codeAt(secret: string, step: number) {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(step));
	const h = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
	const offset = (h[h.length - 1] ?? 0) & 0x0f;
	const bin =
		(((h[offset] ?? 0) & 0x7f) << 24) |
		(((h[offset + 1] ?? 0) & 0xff) << 16) |
		(((h[offset + 2] ?? 0) & 0xff) << 8) |
		((h[offset + 3] ?? 0) & 0xff);
	return String(bin % 1_000_000).padStart(6, "0");
}

/** Passo atual, em unidades de 30 s desde 1970. */
export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Confere o código aceitando o passo atual e um para cada lado (relógio do celular levemente fora).
 * Devolve o passo que bateu (para gravar e não aceitar o mesmo código duas vezes) ou null.
 */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
	if (!/^\d{6}$/.test(code)) return null;
	const given = Buffer.from(code);
	const current = currentStep(now);
	for (const step of [current - 1, current, current + 1]) {
		const expected = Buffer.from(codeAt(secret, step));
		if (timingSafeEqual(given, expected)) return step;
	}
	return null;
}

export function otpauthUrl(secret: string, account: string) {
	const label = encodeURIComponent(`Rastrewin:${account}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=Rastrewin&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
