import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from '../repositories/prisma/prisma-company-payment-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import {
  DEFAULT_PAYMENTS_TAKE,
  FindCompanyPaymentsQueryDto,
} from '../dto/find-company-payments-query.dto';

export async function findCompanyPayments(
  userId: string,
  companyId: string,
  query: FindCompanyPaymentsQueryDto,
  companyPaymentRepository: PrismaCompanyPaymentRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os pagamentos de uma empresa que não é tua',
    permission: 'payments.view',
  });

  const skip = query.skip ?? 0;
  const take = query.take ?? DEFAULT_PAYMENTS_TAKE;

  // O `total` é o número de pagamentos da empresa toda, não o desta página — é
  // dele que o frontend tira quantas páginas existem sem os ir buscar todos
  return companyPaymentRepository.findAllByCompanyId(companyId, { skip, take });
}
