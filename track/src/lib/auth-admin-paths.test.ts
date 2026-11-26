import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ADMIN_API_PATHS, isAdminApiPath } from "./auth-admin-paths";
import { DEFAULT_ROLE, isAdminRole, isRole, ROLES } from "./roles";

test("isAdminApiPath bloqueia /api/auth/admin em qualquer grafia", () => {
	const blocked = [
		"https://track.exemplo.com/api/auth/admin/list-users",
		"https://track.exemplo.com/api/auth/admin/set-role?x=1",
		"https://track.exemplo.com/api/auth/admin",
		"https://track.exemplo.com/api/auth/admin/",
		"https://track.exemplo.com/api/auth/ADMIN/set-role",
		"https://track.exemplo.com/api/auth//admin/set-role",
		"https://track.exemplo.com/api/auth/%61dmin/set-role",
		"https://track.exemplo.com/api/auth/%2561dmin/set-role",
		"https://track.exemplo.com/api/auth/admin%2Fset-role",
		"https://track.exemplo.com/api/auth/admin/impersonate-user",
		"https://track.exemplo.com/api/auth/%E0%A4%A", // codificação inválida: na dúvida, bloqueia
	];
	for (const url of blocked) assert.equal(isAdminApiPath(url), true, url);
});

test("isAdminApiPath deixa passar o login e o resto do Better Auth", () => {
	const allowed = [
		"https://track.exemplo.com/api/auth/sign-in/email",
		"https://track.exemplo.com/api/auth/sign-out",
		"https://track.exemplo.com/api/auth/get-session",
		"https://track.exemplo.com/api/auth/change-password",
		"https://track.exemplo.com/api/auth/administrator-faq", // só o segmento "admin" exato é bloqueado
		"https://track.exemplo.com/painel/usuarios",
	];
	for (const url of allowed) assert.equal(isAdminApiPath(url), false, url);
});

test("ADMIN_API_PATHS cobre todas as rotas do plugin admin instalado", () => {
	// Se o Better Auth ganhar uma rota admin nova, este teste falha até ela entrar na lista
	// (a 2ª barreira, isAdminApiPath, já bloquearia de qualquer jeito).
	const pkg = require.resolve("better-auth/plugins/admin");
	const dir = path.dirname(pkg);
	const source = ["routes.mjs", "admin.mjs"]
		.map(file => {
			try {
				return readFileSync(path.join(dir, file), "utf8");
			} catch {
				return "";
			}
		})
		.join("\n");
	const found = new Set([...source.matchAll(/createAuthEndpoint\("(\/admin\/[a-z-]+)"/g)].map(m => m[1]));
	assert.ok(found.size > 0, "pré-condição: achou as rotas no pacote");
	assert.deepEqual([...found].sort(), [...ADMIN_API_PATHS].sort());
});

test("níveis: só 'admin' é administrador; padrão é Colaborador", () => {
	assert.deepEqual([...ROLES], ["admin", "colaborador"]);
	assert.equal(DEFAULT_ROLE, "colaborador");
	assert.equal(isAdminRole("admin"), true);
	for (const value of [
		"colaborador",
		"Admin",
		"ADMIN",
		" admin",
		"user",
		"",
		null,
		undefined,
		["admin"],
		1,
	])
		assert.equal(isAdminRole(value), false, String(value));
	assert.equal(isRole("colaborador"), true);
	assert.equal(isRole("user"), false);
});
