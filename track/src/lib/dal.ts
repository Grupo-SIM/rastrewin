import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withReader } from "@/db";
import { getAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

/*
 * Camada de acesso a dados do painel (DAL). TODA leitura do painel passa por aqui:
 * valida a sessão no servidor e só então consulta como app_reader (RLS).
 * Não confie só no proxy.ts — ele é apenas um redirecionamento otimista.
 *
 * Níveis (src/lib/roles.ts): o nível vem do banco a cada pedido (getSession lê sessão + usuário;
 * sem cookieCache), então uma troca de nível vale no próximo clique.
 *   - Páginas só de administrador: requireAdmin() (redireciona o Colaborador para /painel).
 *   - Leituras só de administrador: readAsAdmin().
 *   - Server Actions só de administrador: `const denied = await denyUnlessAdmin(); if (denied) return denied;`
 *     como PRIMEIRA linha (o teste src/lib/admin-guard.test.ts confere).
 */

export const getSession = cache(async () => {
	// headers() PRIMEIRO: no pré-render ele adia o resto para o request.
	// Se getAuth() viesse antes, o build tentaria ler o env (que não existe no build).
	const requestHeaders = await headers();
	return getAuth().api.getSession({ headers: requestHeaders });
});

export async function requireSession() {
	const session = await getSession();
	if (!session) redirect("/login");
	return session;
}

/** Executa leituras com RLS em nome do usuário logado. */
export async function readAsUser<T>(fn: Parameters<typeof withReader<T>>[1]): Promise<T> {
	const session = await requireSession();
	return withReader(session.user.id, fn);
}

/** Verdadeiro só para sessão válida de Administrador. Nível ausente ou desconhecido = não admin. */
export async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	return !!session && isAdminRole(session.user.role);
}

/** Páginas só de administrador: sem sessão → /login; Colaborador → /painel. */
export async function requireAdmin() {
	const session = await requireSession();
	if (!isAdminRole(session.user.role)) redirect("/painel");
	return session;
}

/** Leituras só de administrador (Configurações, Saúde), com RLS em nome dele. */
export async function readAsAdmin<T>(fn: Parameters<typeof withReader<T>>[1]): Promise<T> {
	const session = await requireAdmin();
	return withReader(session.user.id, fn);
}

export const FORBIDDEN_MESSAGE = "Sem permissão: só administradores podem fazer isso.";

/**
 * Server Actions só de administrador. Sem sessão → /login (como requireSession).
 * Colaborador → devolve o erro para a action retornar; null = pode seguir.
 */
export async function denyUnlessAdmin(): Promise<{ ok: false; error: string } | null> {
	const session = await requireSession();
	if (isAdminRole(session.user.role)) return null;
	return { error: FORBIDDEN_MESSAGE, ok: false };
}
