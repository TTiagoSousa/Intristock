import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';

type Payment = NonNullable<Awaited<ReturnType<PrismaCompanyInvitationRepository['findMemberPayment']>>>;

/** O ganho pessoal que corresponde a um pagamento da empresa a um membro (o que entrou, recebido). */
export function incomeFromMemberPayment(userId: string, payment: Payment): Prisma.PersonalIncomeUncheckedCreateInput {
  const pay = payment.memberPay;
  return {
    userId,
    kind: pay?.kind === 'freelance' ? 'freelance' : pay?.kind === 'salary' ? 'salary' : 'other',
    memberPayId: pay?.id ?? null,
    // Um ganho por pagamento (único na base): uma segunda confirmação não cria outro
    companyPaymentId: payment.id,
    period: payment.memberPayPeriod ?? null,
    description: [payment.company.name, pay?.description ?? payment.description].filter(Boolean).join(' · '),
    grossAmount: pay ? pay.grossAmount : null,
    withholdingPct: pay?.kind === 'freelance' ? pay.withholdingPct : null,
    amount: payment.amount,
    currencyId: payment.currencyId,
    date: payment.paymentDate,
    status: 'received',
  };
}
