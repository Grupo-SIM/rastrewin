import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.util";

const prisma = new PrismaClient();

/**
 * Cria a única conta admin da plataforma. Roda a cada boot do container (Dockerfile), então NÃO mexe numa conta
 * que já existe: a senha trocada pelo painel não pode voltar para a do .env. Para resetar a senha (esqueceu,
 * ou pôs o .env novo), suba com ADMIN_RESET_PASSWORD=true uma vez. Reset também derruba as sessões e o 2FA.
 */
async function main() {
	const email = process.env.ADMIN_EMAIL;
	const password = process.env.ADMIN_PASSWORD;
	if (!email || !password)
		throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar.");

	const where = { email: email.trim().toLowerCase() };
	const found = await prisma.user.findUnique({ where });
	if (found && process.env.ADMIN_RESET_PASSWORD !== "true") {
		// Sem throw: o seed roda antes do node no CMD, e um erro aqui derrubaria a API inteira.
		if (found.role !== "ADMIN") console.error(`${found.email} existe e NÃO é admin: nada foi alterado`);
		else console.log(`Admin já existe: ${found.email} (senha mantida; ADMIN_RESET_PASSWORD=true para resetar)`);
		return;
	}
	const hash = await hashPassword(password);
	const user = await prisma.user.upsert({
		create: {
			city: "",
			cpf: "",
			email: email.trim().toLowerCase(),
			name: "Admin",
			paidAt: new Date(),
			password: hash,
			phone: "",
			plan: "vip",
			role: "ADMIN",
			status: "ACTIVE",
		},
		update: {
			password: hash,
			role: "ADMIN",
			status: "ACTIVE",
			tokenVersion: { increment: 1 },
			totpEnabled: false,
			totpSecret: null,
		},
		where,
	});
	console.log(`Admin pronto: ${user.email}`);
}

main().finally(() => prisma.$disconnect());
