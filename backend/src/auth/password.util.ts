import { randomBytes } from "node:crypto";
// bcrypt nativo: hash e compare rodam no threadpool do libuv, fora da thread que atende as rotas. O bcryptjs
// (JavaScript puro) gastava centenas de ms de CPU por login nessa thread e travava a API inteira. Mesmo formato:
// os hashes $2a$/$2b$ já gravados continuam valendo, e os novos ($2y$) também são lidos pelo bcryptjs.
import { compare, hash, hashSync } from "@node-rs/bcrypt";

const COST = 12;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Senha aleatória criptograficamente segura (sem caracteres ambíguos como 0/O, 1/l/I). */
export function generatePassword(length = 12) {
	const bytes = randomBytes(length);
	return Array.from(bytes, b => CHARS[b % CHARS.length]).join("");
}

export function hashPassword(plain: string) {
	return hash(plain, COST);
}

export function comparePassword(plain: string, hashed: string) {
	return compare(plain, hashed);
}

/** Hash de uma senha que ninguém tem: o login compara com ele quando a conta não existe, para o tempo
 * de resposta não revelar quais e-mails são clientes. */
export const DUMMY_HASH = hashSync(randomBytes(16).toString("hex"), COST);

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
