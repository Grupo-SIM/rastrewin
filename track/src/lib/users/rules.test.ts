import assert from "node:assert/strict";
import { test } from "node:test";
import {
	changeOwnPasswordSchema,
	checkUserChange,
	createUserSchema,
	LAST_ADMIN_MESSAGE,
	NOT_ADMIN_MESSAGE,
	NOT_FOUND_MESSAGE,
	SELF_MESSAGE,
	userIdsSchema,
	type UserState,
} from "./rules";

const users: UserState[] = [
	{ banned: false, id: "eu", role: "admin" },
	{ banned: false, id: "outro-admin", role: "admin" },
	{ banned: false, id: "colab1", role: "colaborador" },
	{ banned: true, id: "colab2", role: "colaborador" },
];

test("checkUserChange: ninguém mexe em si mesmo (nível, situação, exclusão)", () => {
	for (const change of [
		{ kind: "role", role: "colaborador" },
		{ active: false, kind: "active" },
		{ kind: "delete" },
	] as const)
		assert.equal(checkUserChange(users, "eu", ["colab1", "eu"], change), SELF_MESSAGE);
});

test("checkUserChange: quem age precisa ser administrador ativo no momento", () => {
	assert.equal(checkUserChange(users, "colab1", ["colab2"], { kind: "delete" }), NOT_ADMIN_MESSAGE);
	const demoted = users.map(u => (u.id === "eu" ? { ...u, role: "colaborador" } : u));
	assert.equal(checkUserChange(demoted, "eu", ["colab1"], { kind: "delete" }), NOT_ADMIN_MESSAGE);
	const banned = users.map(u => (u.id === "eu" ? { ...u, banned: true } : u));
	assert.equal(checkUserChange(banned, "eu", ["colab1"], { kind: "delete" }), NOT_ADMIN_MESSAGE);
	assert.equal(checkUserChange(users, "fantasma", ["colab1"], { kind: "delete" }), NOT_ADMIN_MESSAGE);
});

test("checkUserChange: alvo inexistente é recusado", () => {
	assert.equal(checkUserChange(users, "eu", ["colab1", "sumiu"], { kind: "delete" }), NOT_FOUND_MESSAGE);
});

test("checkUserChange: mudanças válidas passam", () => {
	assert.equal(checkUserChange(users, "eu", ["outro-admin"], { kind: "role", role: "colaborador" }), null);
	assert.equal(
		checkUserChange(users, "eu", ["outro-admin", "colab1"], { active: false, kind: "active" }),
		null,
	);
	assert.equal(checkUserChange(users, "eu", ["colab2"], { active: true, kind: "active" }), null);
	assert.equal(checkUserChange(users, "eu", ["colab1", "colab2"], { kind: "delete" }), null);
	assert.equal(checkUserChange(users, "eu", ["colab1"], { kind: "role", role: "admin" }), null);
});

test("checkUserChange: nunca fica sem administrador ativo", () => {
	// Estado inconsistente (ex.: corrida): sobraria só um admin que vai ser rebaixado.
	const lone: UserState[] = [
		{ banned: false, id: "eu", role: "admin" },
		{ banned: false, id: "b", role: "admin" },
	];
	assert.equal(checkUserChange(lone, "eu", ["b"], { kind: "delete" }), null, "eu continuo admin");
	// Se quem age for o último e tentar algo em si, a trava de si mesmo vem antes.
	assert.equal(checkUserChange(lone, "eu", ["eu", "b"], { kind: "delete" }), SELF_MESSAGE);
	assert.equal(LAST_ADMIN_MESSAGE.length > 0, true);
});

test("schemas: e-mail normalizado, senha mínima de 12, nível só admin/colaborador", () => {
	const ok = createUserSchema.safeParse({
		email: "  Pessoa@Empresa.COM ",
		name: " Ana ",
		password: "abcdefghijkl",
		role: "colaborador",
	});
	assert.ok(ok.success);
	assert.equal(ok.data?.email, "pessoa@empresa.com");
	assert.equal(ok.data?.name, "Ana");
	assert.ok(
		!createUserSchema.safeParse({ email: "a@b.co", name: "A", password: "curta", role: "admin" }).success,
	);
	assert.ok(
		!createUserSchema.safeParse({ email: "a@b.co", name: "A", password: "abcdefghijkl", role: "root" })
			.success,
	);
	assert.ok(
		!createUserSchema.safeParse({
			email: "sem-arroba",
			name: "A",
			password: "abcdefghijkl",
			role: "admin",
		}).success,
	);
	assert.ok(
		!createUserSchema.safeParse({ email: "a@b.co", name: "   ", password: "abcdefghijkl", role: "admin" })
			.success,
	);
	assert.ok(
		!changeOwnPasswordSchema.safeParse({ currentPassword: "", newPassword: "abcdefghijkl" }).success,
	);
	assert.deepEqual(userIdsSchema.parse(["a", "a", "b"]), ["a", "b"]);
	assert.ok(!userIdsSchema.safeParse([]).success);
	assert.ok(!userIdsSchema.safeParse(Array.from({ length: 201 }, (_, i) => `u${i}`)).success);
});
