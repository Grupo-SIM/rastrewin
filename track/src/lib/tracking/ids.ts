import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** trck_user_id: 16 caracteres [a-z0-9] (~82 bits) — curto para caber em links e mensagens. */
export function newTrckUserId(): string {
	const bytes = randomBytes(16);
	let out = "";
	for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
	return out;
}
