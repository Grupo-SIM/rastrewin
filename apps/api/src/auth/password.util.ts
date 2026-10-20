import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Senha aleatória criptograficamente segura (sem caracteres ambíguos como 0/O, 1/l/I). */
export function generatePassword(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
