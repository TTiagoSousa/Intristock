import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';
import {
  CreateMemberPayDto,
  MemberPayKind,
  UpdateMemberPayDto,
} from '../dto/member-pay.dto';
import { assertMemberAccess } from './assertMemberAccess';
import { buildMemberPayData } from './buildMemberPayData';

/**
 * Cria (sem `payId`) ou edita um salário ou recibo verde de um membro. O
 * contrato, se vier, tem de ser do mesmo membro.
 */
export async function saveMemberPay(
  userId: string,
  companyId: string,
  memberId: string,
  payId: string | null,
  dto: CreateMemberPayDto | UpdateMemberPayDto,
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

  if (
    dto.contractId &&
    !(await memberRepository.findContract(memberId, dto.contractId))
  ) {
    throw new NotFoundException('Contrato não encontrado');
  }

  if (!payId) {
    const kind = (dto as CreateMemberPayDto).kind;
    return memberRepository.createPay(
      memberId,
      kind,
      buildMemberPayData(kind, dto),
    );
  }

  const current = await memberRepository.findPay(memberId, payId);
  if (!current)
    throw new NotFoundException('Salário ou recibo verde não encontrado');

  return memberRepository.updatePay(
    payId,
    buildMemberPayData(current.kind as MemberPayKind, dto, current),
  );
}
