import { z } from "zod";
import { type Role, ROLES } from "@/lib/roles";

/*
 * Regras da aba Usuários (puras, testadas em rules.test.ts). As Server Actions de
 * src/app/painel/usuarios/actions.ts validam com estes schemas e chamam checkUserChange
 * DENTRO da transação que trava as linhas (ver users/mutations.ts).
 */

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 128;
/** Quantos usuários uma ação em massa aceita de uma vez. */
export const MAX_BULK = 200;

const name = z.string().trim().min(1, "Informe o nome.").max(100, "Use até 100 caracteres.");
const email = z
	.string()
	.trim()
	.toLowerCase()
	.max(254, "E-mail longo demais.")
	.pipe(z.email("Informe um e-mail válido."));
export const passwordSchema = z
	.string()
	.min(MIN_PASSWORD, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
	.max(MAX_PASSWORD, `Use até ${MAX_PASSWORD} caracteres.`);
const role = z.enum(ROLES, "Escolha o nível de acesso.");
export const userIdSchema = z.string().min(1).max(64);
export const userIdsSchema = z
	.array(userIdSchema)
	.min(1, "Selecione ao menos um usuário.")
	.max(MAX_BULK, `Selecione até ${MAX_BULK} usuários por vez.`)
	.transform(ids => [...new Set(ids)]);

export const bulkRoleSchema = z.object({ ids: userIdsSchema, role: z.enum(ROLES, "Nível inválido.") });
export const bulkActiveSchema = z.object({ active: z.boolean("Situação inválida."), ids: userIdsSchema });

export const createUserSchema = z.object({ email, name, password: passwordSchema, role });
export const updateUserSchema = z.object({ email, id: userIdSchema, name, role });
export const resetPasswordSchema = z.object({ id: userIdSchema, password: passwordSchema });
export const changeOwnPasswordSchema = z.object({
	currentPassword: z.string().min(1, "Informe a senha atual.").max(MAX_PASSWORD),
	newPassword: passwordSchema,
});

export type UserChange =
	{ kind: "role"; role: Role } | { kind: "active"; active: boolean } | { kind: "delete" };

export interface UserState {
	id: string;
	role: string;
	banned: boolean;
}

export const SELF_MESSAGE = "Você não pode mudar o próprio nível, desativar nem excluir a sua conta.";
export const LAST_ADMIN_MESSAGE = "O painel precisa de pelo menos um administrador ativo.";
export const NOT_FOUND_MESSAGE = "Usuário não encontrado. Recarregue a página.";
export const NOT_ADMIN_MESSAGE = "Sem permissão: só administradores podem fazer isso.";

const activeAdmin = (u: UserState) => u.role === "admin" && !u.banned;

/**
 * Confere uma mudança antes de gravar. `users` = estado ATUAL (lido com trava) de todos os
 * administradores, de quem age e dos alvos. Devolve a mensagem de erro, ou null se pode seguir.
 */
export function checkUserChange(
	users: UserState[],
	actorId: string,
	targetIds: string[],
	change: UserChange,
): string | null {
	const byId = new Map(users.map(u => [u.id, u]));
	const actor = byId.get(actorId);
	// Quem age precisa continuar administrador ativo AGORA (outro admin pode tê-lo rebaixado agora há pouco).
	if (!actor || !activeAdmin(actor)) return NOT_ADMIN_MESSAGE;
	if (targetIds.includes(actorId)) return SELF_MESSAGE;
	if (targetIds.some(id => !byId.has(id))) return NOT_FOUND_MESSAGE;

	const after = new Map(byId);
	for (const id of targetIds) {
		const u = byId.get(id)!;
		if (change.kind === "delete") after.delete(id);
		else if (change.kind === "role") after.set(id, { ...u, role: change.role });
		else after.set(id, { ...u, banned: !change.active });
	}
	if (![...after.values()].some(activeAdmin)) return LAST_ADMIN_MESSAGE;
	return null;
}

/** Primeiro erro de cada campo, para o formulário. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? "form");
		out[key] ??= issue.message;
	}
	return out;
}
