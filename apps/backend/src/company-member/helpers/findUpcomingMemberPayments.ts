import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';
import {
  DEFAULT_UPCOMING_MONTHS,
  UpcomingPaymentsQueryDto,
} from '../dto/upcoming-payments-query.dto';
import { listMemberPaymentsDue } from './listMemberPaymentsDue';

// Os meses para trás onde ainda se procuram salários por pagar (em atraso)
const OVERDUE_MONTHS = 2;

/**
 * Os pagamentos aos membros que ainda não se fizeram, do mais antigo ao mais
 * recente: dos últimos `OVERDUE_MONTHS` meses até ao fim dos próximos `months`
 * (`listMemberPaymentsDue`). Calcula-se ao ler; um período sai da lista quando
 * há um pagamento (não cancelado) ligado a ele (`memberPayId` + `memberPayPeriod`).
 */
export async function findUpcomingMemberPayments(
  userId: string,
  companyId: string,
  query: UpcomingPaymentsQueryDto,
  companyRepository: PrismaCompanyRepository,
  memberRepository: PrismaCompanyMemberRepository,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes ver os pagamentos de uma empresa que não é tua',
      permission: 'salaries.view',
    },
  );

  const months = query.months ?? DEFAULT_UPCOMING_MONTHS;
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - OVERDUE_MONTHS, 1),
  );
  const until = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 0),
  );

  const pays = await memberRepository.findCompanyPays(companyId);
  const paid = await memberRepository.findPaidPeriods(
    pays.map((pay) => pay.id),
  );
  const companyCurrency = await memberRepository.findCurrency(
    company.currencyId,
  );

  return listMemberPaymentsDue(
    pays,
    paid,
    firstMonth,
    until,
    today,
    companyCurrency,
  );
}
