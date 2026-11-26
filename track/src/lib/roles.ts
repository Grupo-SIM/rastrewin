/*
 * Níveis de acesso ao painel. Fonte única: o CHECK do banco (drizzle/0014_user_roles.sql),
 * o plugin admin (src/lib/auth.ts) e as telas usam estas constantes.
 * Sem imports: pode ser usado também em componentes do cliente (só rótulos, nunca para proteger nada).
 */

export const ROLES = ["admin", "colaborador"] as const;
export type Role = (typeof ROLES)[number];

/** Nível de quem é criado sem escolher (também é o padrão da coluna). */
export const DEFAULT_ROLE: Role = "colaborador";

export const ROLE_LABEL: Record<Role, { name: string; plural: string; description: string }> = {
	admin: { description: "Acesso total", name: "Administrador", plural: "Administradores" },
	colaborador: { description: "Acesso limitado", name: "Colaborador", plural: "Colaboradores" },
};

export function isRole(value: unknown): value is Role {
	return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Só "admin" é administrador. Valor ausente ou desconhecido NUNCA é tratado como admin. */
export function isAdminRole(role: unknown): boolean {
	return role === "admin";
}
