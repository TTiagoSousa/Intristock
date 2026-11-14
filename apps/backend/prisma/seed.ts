import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminJobType = await prisma.jobType.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  await prisma.employee.upsert({
    where: { email: 'admin@intristock.com' },
    update: {},
    create: {
      employeeNumber: 'EMP-001',
      email: 'admin@intristock.com',
      fullName: 'Admin',
      firstName: 'Admin',
      lastName: '',
      hashedPassword: await bcrypt.hash('admin123456', 12),
      jobTypeId: adminJobType.id,
    },
  });

  await prisma.currency.upsert({
    where: { shortCode: 'USD' },
    update: {},
    create: {
      name: 'US Dollar',
      shortCode: 'USD',
      code: '840',
      precision: 2,
      subunit: 100,
      symbol: '$',
      symbolFirst: true,
      decimalMark: '.',
      thousandsSeparator: ',',
      rate: 1,
    },
  });

  await prisma.currency.upsert({
    where: { shortCode: 'EUR' },
    update: {},
    create: {
      name: 'Euro',
      shortCode: 'EUR',
      code: '978',
      precision: 2,
      subunit: 100,
      symbol: '€',
      symbolFirst: false,
      decimalMark: ',',
      thousandsSeparator: '.',
      // Valor de arranque, substituído pela primeira ronda de cotações. Não
      // pode ficar a 0: a conversão divide pela taxa, e uma taxa a zero fazia
      // toda a app rebentar em silêncio antes da primeira sincronização.
      rate: 0.86,
    },
  });

  // O admin da app (o mesmo que a instalação na VM cria): entra com admin / admin
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      email: 'admin',
      fullName: 'Administrador',
      firstName: 'Administrador',
      lastName: '',
      hashedPassword: await bcrypt.hash('admin', 12),
      role: 'ADMIN',
      active: true,
    },
  });

  console.log('Seed concluído — app: admin / admin');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
