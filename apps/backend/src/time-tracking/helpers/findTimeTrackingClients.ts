import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Os clientes das ligações da empresa, com o cliente da empresa a que estão ligados e os projetos. */
export async function findTimeTrackingClients(
  userId: string,
  companyId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const [clients, settlements] = await Promise.all([
    repository.findClients(companyId),
    repository.findSettlementsList(companyId, {}),
  ]);
  // As horas que cada cliente pagou adiantadas e ainda não se gastaram, e quanto valem
  const credit = new Map<string, { seconds: number; amount: number }>();
  for (const settlement of settlements) {
    const allocated = settlement.allocations.reduce((sum, allocation) => sum + allocation.seconds, 0);
    const left = settlement.seconds - allocated;
    if (left <= 0) continue;
    const slot = credit.get(settlement.clientId) ?? { seconds: 0, amount: 0 };
    slot.seconds += left;
    slot.amount += (left / 3600) * Number(settlement.hourlyRate);
    credit.set(settlement.clientId, slot);
  }
  return clients.map((client) => ({
    id: client.id,
    connectionId: client.connectionId,
    organizationName: client.connection.organizationName,
    name: client.name,
    isArchived: client.isArchived,
    supplier: client.supplier,
    hourlyRate: num(client.hourlyRate),
    billing: client.billing,
    withholdingPct: num(client.withholdingPct),
    creditSeconds: credit.get(client.id)?.seconds ?? 0,
    creditAmount: Math.round((credit.get(client.id)?.amount ?? 0) * 100) / 100,
    projects: client.projects.map((project) => ({ ...project, billableRate: num(project.billableRate) })),
  }));
}
