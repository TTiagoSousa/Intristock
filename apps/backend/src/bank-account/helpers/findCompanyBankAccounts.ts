import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaBankAccountRepository } from '../repositories/prisma/prisma-bank-account-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { attachAccountBalances } from './calculateAccountBalances';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export async function findCompanyBankAccounts(
  userId: string,
  companyId: string,
  bankAccountRepository: PrismaBankAccountRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver as contas de uma empresa que não é tua',
    permission: ['settings.view', 'payments.view'],
  });

  const [accounts, totals] = await Promise.all([
    bankAccountRepository.findAllByCompanyId(companyId),
    bankAccountRepository.sumMovementsByCompany(companyId),
  ]);

  return attachAccountBalances(accounts, totals);
}
