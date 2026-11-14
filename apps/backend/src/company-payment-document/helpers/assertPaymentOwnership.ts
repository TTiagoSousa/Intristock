import { NotFoundException } from '@nestjs/common';
import { assertCompanyAccess, CompanyAccessPermission } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyPaymentRepository } from 'src/company-payment/repositories/prisma/prisma-company-payment-repository';

/**
 * Mesma regra do resto da app: trabalhadores leem, só quem criou a empresa é
 * que grava. E o pagamento tem de ser mesmo dessa empresa — sem esse segundo
 * teste, quem soubesse um id conseguia chegar ao pagamento de outra empresa
 * através de uma empresa sua.
 */
export async function assertPaymentOwnership(
  userId: string,
  companyId: string,
  paymentId: string,
  companyRepository: PrismaCompanyRepository,
  paymentRepository: PrismaCompanyPaymentRepository,
  // O que é preciso (`assertCompanyAccess`): ver lê, o resto grava
  permission: CompanyAccessPermission,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir documentos de uma empresa que não é tua',
    permission,
  });

  const payment = await paymentRepository.findById(paymentId);

  if (!payment || payment.companyId !== companyId) {
    throw new NotFoundException('Pagamento não encontrado');
  }

  return payment;
}
