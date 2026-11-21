import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

/** O banco de horas: ver lê (`timesheet.view`), o resto grava (`timesheet.manage`). */
export function assertTimesheetAccess(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  write: boolean,
) {
  return assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver o banco de horas de uma empresa que não é tua',
    permission: write ? 'timesheet.manage' : 'timesheet.view',
  });
}
