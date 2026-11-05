import type { User } from "@prisma/client";

/** Nunca expor o hash da senha, o código OTP pendente nem o rastreamento nas respostas da API. */
export function toPublicUser<T extends Partial<User>>(u: T) {
	const { password: _password, otpCode: _otpCode, tracking: _tracking, ...rest } = u;
	return rest;
}
