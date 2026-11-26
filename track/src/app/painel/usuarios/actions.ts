"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { ActionResult } from "@/lib/config/types";
import { denyUnlessAdmin, requireSession } from "@/lib/dal";
import { safeErrorMessage } from "@/lib/errors";
import {
	applyChange,
	insertUser,
	pgCode,
	setPassword,
	updateProfile,
	withLockedUsers,
} from "@/lib/users/data";
import {
	bulkActiveSchema,
	bulkRoleSchema,
	changeOwnPasswordSchema,
	createUserSchema,
	fieldErrorsOf,
	resetPasswordSchema,
	SELF_MESSAGE,
	updateUserSchema,
	type UserChange,
	userIdsSchema,
} from "@/lib/users/rules";

/*
 * Server Actions são endpoints públicos. TODA função aqui:
 *   1. começa com denyUnlessAdmin() (só Administrador; o teste src/lib/admin-guard.test.ts confere);
 *   2. valida a entrada com Zod (src/lib/users/rules.ts);
 *   3. em usuários existentes, grava dentro de withLockedUsers (trava: não mexer em si mesmo,
 *      nunca ficar sem administrador ativo, quem age ainda é admin no momento da gravação).
 * Senhas nunca são registradas em log nem devolvidas.
 */

const INVALID = "Confira os campos destacados.";
const EMAIL_TAKEN = { email: "Já existe um usuário com esse e-mail." };

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
	return { error, fieldErrors, ok: false };
}

async function actorId() {
	return (await requireSession()).user.id;
}

/** Aplica uma mudança a usuários existentes (ids já validados com Zod pela action). */
async function change(
	targets: string[],
	change: UserChange,
	done: (n: number) => string,
): Promise<ActionResult> {
	try {
		const error = await withLockedUsers(await actorId(), targets, change, tx =>
			applyChange(tx, targets, change),
		);
		if (error) return fail(error);
	} catch (error) {
		console.error("[usuários] falha ao alterar", safeErrorMessage(error));
		return fail("Não foi possível concluir. Tente de novo.");
	}
	refresh();
	return { message: done(targets.length), ok: true };
}

const plural = (n: number) => (n === 1 ? "1 usuário" : `${n} usuários`);

export async function createUser(input: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = createUserSchema.safeParse(input);
	if (!parsed.success) return fail(INVALID, fieldErrorsOf(parsed.error));
	try {
		await insertUser(parsed.data);
	} catch (error) {
		if (pgCode(error) === "23505") return fail("Esse e-mail já tem acesso ao painel.", EMAIL_TAKEN);
		console.error("[usuários] falha ao criar", safeErrorMessage(error));
		return fail("Não foi possível criar o usuário. Tente de novo.");
	}
	refresh();
	return { message: "Usuário criado. Passe a senha para a pessoa por um canal seguro.", ok: true };
}

/** Nome, e-mail e nível. Na própria conta só o nome muda (nível e e-mail ficam travados). */
export async function updateUser(input: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = updateUserSchema.safeParse(input);
	if (!parsed.success) return fail(INVALID, fieldErrorsOf(parsed.error));
	const { id, name, email, role } = parsed.data;
	const me = await requireSession();
	if (id === me.user.id) {
		if (email !== me.user.email.toLowerCase() || role !== me.user.role) return fail(SELF_MESSAGE);
		try {
			const error = await withLockedUsers(me.user.id, [], { kind: "role", role }, tx =>
				updateProfile(tx, id, { email, name }),
			);
			if (error) return fail(error);
		} catch (error) {
			console.error("[usuários] falha ao editar", safeErrorMessage(error));
			return fail("Não foi possível salvar. Tente de novo.");
		}
		refresh();
		return { message: "Dados atualizados.", ok: true };
	}
	try {
		const error = await withLockedUsers(me.user.id, [id], { kind: "role", role }, async tx => {
			await updateProfile(tx, id, { email, name });
			await applyChange(tx, [id], { kind: "role", role });
		});
		if (error) return fail(error);
	} catch (error) {
		if (pgCode(error) === "23505") return fail("Esse e-mail já tem acesso ao painel.", EMAIL_TAKEN);
		console.error("[usuários] falha ao editar", safeErrorMessage(error));
		return fail("Não foi possível salvar. Tente de novo.");
	}
	refresh();
	return { message: "Usuário atualizado.", ok: true };
}

/** Senha definida pelo administrador para OUTRA pessoa; derruba as sessões dela. */
export async function resetUserPassword(input: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = resetPasswordSchema.safeParse(input);
	if (!parsed.success) return fail(INVALID, fieldErrorsOf(parsed.error));
	const { id, password } = parsed.data;
	let error: string | null;
	try {
		// "active: true" não muda a situação: serve para as travas (não em si mesmo, alvo existe, quem age é admin).
		// Um alvo desativado continua desativado: o withLockedUsers só confere, quem grava é setPassword.
		error = await withLockedUsers(await actorId(), [id], { active: true, kind: "active" }, tx =>
			setPassword(tx, id, password),
		);
	} catch (err) {
		console.error("[usuários] falha ao redefinir senha", safeErrorMessage(err));
		return fail("Não foi possível trocar a senha. Tente de novo.");
	}
	if (error) return fail(error === SELF_MESSAGE ? "Para a sua senha, use Trocar senha." : error);
	refresh();
	return { message: "Senha alterada. A pessoa foi desconectada de todos os aparelhos.", ok: true };
}

export async function setUsersRole(ids: unknown, role: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = bulkRoleSchema.safeParse({ ids, role });
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
	return change(
		parsed.data.ids,
		{ kind: "role", role: parsed.data.role },
		n =>
			`${plural(n)} agora ${n === 1 ? "é" : "são"} ${parsed.data.role === "admin" ? "Administrador" : "Colaborador"}.`,
	);
}

export async function setUsersActive(ids: unknown, active: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = bulkActiveSchema.safeParse({ active, ids });
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
	return change(parsed.data.ids, { active: parsed.data.active, kind: "active" }, n =>
		parsed.data.active ? `${plural(n)} ativado(s).` : `${plural(n)} desativado(s) e desconectado(s).`,
	);
}

export async function deleteUsers(ids: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = userIdsSchema.safeParse(ids);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
	return change(parsed.data, { kind: "delete" }, n => `${plural(n)} excluído(s).`);
}

/** Troca da PRÓPRIA senha: confere a atual e desconecta os outros aparelhos. */
export async function changeOwnPassword(input: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = changeOwnPasswordSchema.safeParse(input);
	if (!parsed.success) return fail(INVALID, fieldErrorsOf(parsed.error));
	try {
		await getAuth().api.changePassword({
			body: { ...parsed.data, revokeOtherSessions: true },
			headers: await headers(),
		});
	} catch (error) {
		const code = (error as { body?: { code?: string } })?.body?.code;
		if (code === "INVALID_PASSWORD")
			return fail("Senha atual incorreta.", { currentPassword: "Senha atual incorreta." });
		console.error("[usuários] falha ao trocar a própria senha", code ?? "erro");
		return fail("Não foi possível trocar a senha. Tente de novo.");
	}
	refresh();
	return { message: "Senha alterada. Seus outros aparelhos foram desconectados.", ok: true };
}
