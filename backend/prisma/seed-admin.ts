import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.util";

const prisma = new PrismaClient();

/** Cria (ou reseta a senha de) a única conta admin da plataforma. */
async function main() {
	const email = process.env.ADMIN_EMAIL;
	const password = process.env.ADMIN_PASSWORD;
	if (!email || !password)
		throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar.");

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
		update: { password: hash, role: "ADMIN", status: "ACTIVE" },
		where: { email: email.trim().toLowerCase() },
	});
	console.log(`Admin pronto: ${user.email}`);
}

main().finally(() => prisma.$disconnect());
