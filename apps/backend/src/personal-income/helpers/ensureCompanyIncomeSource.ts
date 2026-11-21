import { PrismaService } from 'src/prisma/prisma.service';

/**
 * A fonte dos ganhos de uma pessoa que vêm de uma empresa da base (as horas pagas no banco de
 * horas): quem paga é a empresa, não os clientes dela. Usa a fonte que a pessoa já tenha ligada
 * a essa empresa; sem nenhuma, cria uma (`client`: a pessoa passa recibos à empresa) com o nome dela.
 */
export async function ensureCompanyIncomeSource(
  prisma: PrismaService,
  userId: string,
  company: { id: string; name: string },
) {
  const existing = await prisma.personalIncomeSource.findFirst({
    where: { userId, companyId: company.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.personalIncomeSource.create({
    data: { userId, kind: 'client', name: company.name, companyId: company.id },
    select: { id: true },
  });
  return created.id;
}
