import { PrismaClient } from '@prisma/client';
import { makeRaffleData } from '../src/mock';

const prisma = new PrismaClient();

async function main() {
  await prisma.entry.deleteMany();
  await prisma.raffle.deleteMany();
  await prisma.user.deleteMany();
  const data = Array.from({ length: 48 }, (_, i) => makeRaffleData(i < 8));
  await prisma.raffle.createMany({ data });
  console.log(`Seed ok: ${data.length} sorteios`);
}

main().finally(() => prisma.$disconnect());
