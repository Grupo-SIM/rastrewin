/*
 * Rotas HTTP do plugin admin do Better Auth (/api/auth/admin/*): TODAS fechadas.
 * Usuários são geridos só pelas Server Actions de /painel/usuarios, que chamam auth.api.* no servidor
 * e aplicam as travas (não mexer em si mesmo, nunca ficar sem administrador).
 * Duas barreiras: `disabledPaths` do Better Auth (comparação exata) e `isAdminApiPath` na rota do Next
 * (pega variações de maiúsculas, barras repetidas e caminho codificado).
 */

/** Caminhos do plugin admin no Better Auth 1.7.15 (conferido em dist/plugins/admin). */
export const ADMIN_API_PATHS = [
	"/admin/ban-user",
	"/admin/create-user",
	"/admin/get-user",
	"/admin/has-permission",
	"/admin/impersonate-user",
	"/admin/list-user-sessions",
	"/admin/list-users",
	"/admin/remove-user",
	"/admin/revoke-user-session",
	"/admin/revoke-user-sessions",
	"/admin/set-role",
	"/admin/set-user-password",
	"/admin/stop-impersonating",
	"/admin/unban-user",
	"/admin/update-user",
] as const;

const AUTH_BASE = "/api/auth";

/** Verdadeiro para qualquer pedido a /api/auth/admin ou abaixo dele, em qualquer grafia. */
export function isAdminApiPath(url: string): boolean {
	let path: string;
	try {
		path = new URL(url, "http://localhost").pathname;
	} catch {
		return true; // URL ilegível: na dúvida, bloqueia
	}
	// Decodifica até estabilizar (%2561 → %61 → a), limitado.
	for (let i = 0; i < 3; i += 1) {
		let decoded: string;
		try {
			decoded = decodeURIComponent(path);
		} catch {
			return true;
		}
		if (decoded === path) break;
		path = decoded;
	}
	const normalized = path
		.toLowerCase()
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/");
	if (!normalized.startsWith(`${AUTH_BASE}/`)) return false;
	const rest = normalized.slice(AUTH_BASE.length);
	return rest === "/admin" || rest.startsWith("/admin/");
}
