import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

const prisma = new PrismaClient();

/** Cria (ou reseta a senha de) a única conta admin da plataforma. */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar.');

  const hash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: email.trim().toLowerCase() },
    update: { role: 'ADMIN', password: hash, status: 'ACTIVE' },
    create: {
      email: email.trim().toLowerCase(),
      password: hash,
      role: 'ADMIN',
      status: 'ACTIVE',
      name: 'Admin',
      cpf: '',
      phone: '',
      city: '',
      plan: 'vip',
      paidAt: new Date(),
    },
  });
  console.log(`Admin pronto: ${user.email}`);
}

main().finally(() => prisma.$disconnect());
