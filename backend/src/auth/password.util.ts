import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const COST = 12;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Senha aleatória criptograficamente segura (sem caracteres ambíguos como 0/O, 1/l/I). */
export function generatePassword(length = 12) {
	const bytes = randomBytes(length);
	return Array.from(bytes, b => CHARS[b % CHARS.length]).join("");
}

export function hashPassword(plain: string) {
	return bcrypt.hash(plain, COST);
}

export function comparePassword(plain: string, hash: string) {
	return bcrypt.compare(plain, hash);
}

/** Hash de uma senha que ninguém tem: o login compara com ele quando a conta não existe, para o tempo
 * de resposta não revelar quais e-mails são clientes. */
export const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), COST);

const COMMON = new Set([
	"12345678",
	"123456789",
	"1234567890",
	"87654321",
	"11111111",
	"00000000",
	"password",
	"password1",
	"senha123",
	"senha1234",
	"mudar123",
	"qwertyui",
	"qwerty123",
	"abcd1234",
	"abc12345",
	"iloveyou",
	"brasil123",
	"rastrewin",
	"rastrewin1",
	"rastrewin123",
]);

/** Recusa as senhas mais comuns e as de um caractere só. */
export function isWeakPassword(plain: string) {
	const p = plain.toLowerCase();
	return COMMON.has(p) || /^(.)\1+$/.test(p);
}
