import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/**
 * As pessoas das ligações da empresa e a quem vão as horas de cada uma: um membro, o dono
 * (`owner`, ligado só pela conta) ou ninguém.
 */
export async function findTimeTrackingPeople(
  userId: string,
  companyId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  const company = await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const people = await repository.findPeople(companyId);
  return people.map((person) => ({
    id: person.id,
    connectionId: person.connectionId,
    organizationName: person.connection.organizationName,
    name: person.name,
    billableRate: person.billableRate === null ? null : Number(person.billableRate),
    payRate: person.payRate === null ? null : Number(person.payRate),
    payWithholdingPct: person.payWithholdingPct === null ? null : Number(person.payWithholdingPct),
    member: person.member
      ? {
          id: person.member.id,
          name: person.member.name ?? person.member.user?.fullName ?? null,
          hasAccount: !!person.member.user,
        }
      : null,
    owner: !person.member && person.userId === company.createdById,
    user: person.user,
  }));
}
