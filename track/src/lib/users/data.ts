import "server-only";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { type ReaderTx, serviceDb } from "@/db";
import { account, session, settings, user } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { isRole, type Role } from "@/lib/roles";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { checkUserChange, type UserChange } from "./rules";

/*
 * Acesso a dados da aba Usuários. As tabelas de login NÃO são legíveis pelo app_reader (RLS),
 * então leitura e escrita usam app_service — SEMPRE depois de requireAdmin()/denyUnlessAdmin().
 * Toda mudança em usuários existentes roda em `withLockedUsers`: trava as linhas (FOR UPDATE)
 * dos administradores, de quem age e dos alvos e confere checkUserChange com o estado travado.
 */

export interface UserRow {
	id: string;
	name: string;
	email: string;
	role: Role;
	banned: boolean;
	createdAt: string;
	/** Último login ou renovação de sessão (sessões vencidas são apagadas na limpeza diária). */
	lastSeenAt: string | null;
}

export interface UsersView {
	users: UserRow[];
	meId: string;
	timeZone: string;
}

export async function listUsers(): Promise<UsersView> {
	const me = await requireAdmin();
	const db = serviceDb();
	const [rows, [cfg]] = await Promise.all([
		db
			.select({
				banned: user.banned,
				createdAt: user.createdAt,
				email: user.email,
				id: user.id,
				// "user"."id" por extenso: dentro da subconsulta, ${user.id} sairia só "id" (= o id da sessão).
				lastSeenAt: sql<Date | null>`(select max(greatest(s.created_at, s.updated_at)) from "session" s where s.user_id = "user"."id")`,
				name: user.name,
				role: user.role,
			})
			.from(user)
			.orderBy(sql`${user.role} = 'admin' desc`, user.name),
		db.select({ timezone: settings.timezone }).from(settings).limit(1),
	]);
	return {
		meId: me.user.id,
		timeZone: cfg?.timezone ?? DEFAULT_TIMEZONE,
		users: rows.map(r => ({
			...r,
			createdAt: r.createdAt.toISOString(),
			lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
			role: isRole(r.role) ? r.role : "colaborador",
		})),
	};
}

type Tx = ReaderTx;

/** Código de erro do Postgres (o Drizzle embrulha o erro do pg em `cause`). */
export function pgCode(error: unknown): string | undefined {
	const e = error as { code?: string; cause?: { code?: string } };
	return e?.cause?.code ?? e?.code;
}

/**
 * Trava e confere: roda `fn` só se checkUserChange aprovar. Devolve a mensagem de erro, ou null.
 * Duas ações ao mesmo tempo (ex.: dois admins rebaixando um ao outro) esperam uma pela outra.
 */
export async function withLockedUsers(
	actorId: string,
	targetIds: string[],
	change: UserChange,
	fn: (tx: Tx) => Promise<void>,
): Promise<string | null> {
	return serviceDb().transaction(async tx => {
		const state = await tx
			.select({ banned: user.banned, id: user.id, role: user.role })
			.from(user)
			.where(or(eq(user.role, "admin"), inArray(user.id, [actorId, ...targetIds])))
			.orderBy(user.id)
			.for("update");
		const error = checkUserChange(state, actorId, targetIds, change);
		if (error) return error;
		await fn(tx);
		return null;
	});
}

export async function revokeSessions(tx: Tx, userIds: string[]) {
	await tx.delete(session).where(inArray(session.userId, userIds));
}

export async function applyChange(tx: Tx, ids: string[], change: UserChange) {
	if (change.kind === "delete") {
		// account e session caem em cascata (FK ON DELETE CASCADE).
		await tx.delete(user).where(inArray(user.id, ids));
		return;
	}
	if (change.kind === "role") {
		await tx.update(user).set({ role: change.role }).where(inArray(user.id, ids));
		return;
	}
	await tx
		.update(user)
		.set(
			change.active
				? { banExpires: null, banned: false, banReason: null }
				: { banExpires: null, banned: true, banReason: "Desativado no painel" },
		)
		.where(inArray(user.id, ids));
	if (!change.active) await revokeSessions(tx, ids);
}

/** Cria usuário + login por e-mail/senha (mesmo formato do Better Auth e do create-admin). */
export async function insertUser(input: { name: string; email: string; password: string; role: Role }) {
	const hash = await hashPassword(input.password);
	await serviceDb().transaction(async tx => {
		const id = generateRandomString(32, "a-z", "A-Z", "0-9");
		await tx
			.insert(user)
			.values({ email: input.email, emailVerified: true, id, name: input.name, role: input.role });
		await tx.insert(account).values({
			accountId: id,
			id: generateRandomString(32, "a-z", "A-Z", "0-9"),
			password: hash,
			providerId: "credential",
			userId: id,
		});
	});
}

/** Troca a senha do login por e-mail/senha (cria o login se não existir) e derruba as sessões. */
export async function setPassword(tx: Tx, userId: string, password: string) {
	const hash = await hashPassword(password);
	const updated = await tx
		.update(account)
		.set({ password: hash })
		.where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
		.returning({ id: account.id });
	if (!updated.length)
		await tx.insert(account).values({
			accountId: userId,
			id: generateRandomString(32, "a-z", "A-Z", "0-9"),
			password: hash,
			providerId: "credential",
			userId,
		});
	await revokeSessions(tx, [userId]);
}

export async function updateProfile(tx: Tx, id: string, data: { name: string; email: string }) {
	await tx.update(user).set(data).where(eq(user.id, id));
}
