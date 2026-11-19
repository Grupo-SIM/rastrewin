import type { User } from "@prisma/client";

/**
 * O que o PRÓPRIO usuário vê de si mesmo. É uma lista do que pode sair (não do que fica de fora): campo novo
 * no schema nunca vaza por esquecimento. CPF, Pix, telefone e códigos nunca voltam por aqui.
 */
export function toPublicUser(u: User) {
	return {
		createdAt: u.createdAt,
		email: u.email,
		expiresAt: u.expiresAt,
		id: u.id,
		name: u.name,
		paidAt: u.paidAt,
		pendingPlan: u.pendingPlan,
		phoneVerified: u.phoneVerified,
		plan: u.plan,
		role: u.role,
		status: u.status,
	};
}

/** O que o ADMIN vê de um cliente: o cadastro completo, sem senha, códigos, 2FA nem rastreamento. */
export function toAdminUser(u: User) {
	return {
		...toPublicUser(u),
		city: u.city,
		cpf: u.cpf,
		phone: u.phone,
		pix: u.pix,
	};
}
