import type { User } from '@prisma/client';

/** Nunca expor o hash da senha nem o código OTP pendente nas respostas da API. */
export function toPublicUser<T extends Partial<User>>(u: T) {
  const { password: _password, otpCode: _otpCode, ...rest } = u;
  return rest;
}
