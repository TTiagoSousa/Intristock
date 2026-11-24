import { resolveMemberPermissions } from 'src/company/permissions/companyPermissions';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';

export interface LeadPerson {
  id: string;
  name: string;
}

/**
 * Quem pode ficar com leads: o dono da empresa e os membros ativos com conta que trabalham nas leads
 * (`leads.work`). Pelo nome.
 */
export async function findLeadPeople(
  companyRepository: PrismaCompanyRepository,
  repository: PrismaCompanyLeadRepository,
  company: { id: string; createdById: string },
): Promise<LeadPerson[]> {
  const members = await companyRepository.findMembersByCompanyId(company.id);
  const people = new Map<string, string>();
  for (const member of members) {
    if (!member.userId || !member.user || member.status !== 'active') continue;
    if (resolveMemberPermissions(member).includes('leads.work')) people.set(member.userId, member.user.fullName);
  }
  if (!people.has(company.createdById)) {
    const [owner] = await repository.findUserNames([company.createdById]);
    if (owner) people.set(owner.id, owner.fullName);
  }
  return [...people].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
}
