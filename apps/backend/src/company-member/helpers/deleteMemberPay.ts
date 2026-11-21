import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';
import { assertMemberAccess } from './assertMemberAccess';

/** Apaga um salário ou recibo verde que ainda não tenha pagamentos. */
export async function deleteMemberPay(
  userId: string,
  companyId: string,
  memberId: string,
  payId: string,
  companyRepository: PrismaCompanyRepository,
  memberRepository: PrismaCompanyMemberRepository,
) {
  await assertMemberAccess(
    userId,
    companyId,
    memberId,
    'salaries.manage',
    companyRepository,
    memberRepository,
  );

  const pay = await memberRepository.findPay(memberId, payId);
  if (!pay)
    throw new NotFoundException('Salário ou recibo verde não encontrado');

  // Com pagamentos fica o histórico: um salário acaba-se com a data de fim
  if (pay._count.payments > 0) {
    throw new ConflictException(
      pay.kind === 'salary'
        ? 'Este salário já tem pagamentos: põe-lhe uma data de fim em vez de o apagar'
        : 'Este recibo verde já foi pago e não se pode apagar',
    );
  }

  // Um ganho pessoal que aponta para ele também é histórico (e a ligação não o deixava apagar)
  if ((await memberRepository.countPayIncomes(payId)) > 0) {
    throw new ConflictException(
      'O membro já registou ganhos deste salário: põe-lhe uma data de fim em vez de o apagar',
    );
  }

  await memberRepository.deletePay(payId);
}
