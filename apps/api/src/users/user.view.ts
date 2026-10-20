import type { User } from '@prisma/client';

/** Nunca expor o hash da senha nas respostas da API. */
export function toPublicUser<T extends Partial<User>>(u: T) {
  const { password: _password, ...rest } = u;
  return rest;
}
