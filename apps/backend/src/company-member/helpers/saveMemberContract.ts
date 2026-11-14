import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';
import { MemberContractData } from '../repositories/company-member-repository';
import {
  CreateMemberContractDto,
  UpdateMemberContractDto,
} from '../dto/member-contract.dto';
import { assertMemberAccess } from './assertMemberAccess';

/** Cria (sem `contractId`) ou edita um contrato de um membro. */
export async function saveMemberContract(
  userId: string,
  companyId: string,
  memberId: string,
  contractId: string | null,
  dto: CreateMemberContractDto | UpdateMemberContractDto,
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

  const current = contractId
    ? await memberRepository.findContract(memberId, contractId)
    : null;
  if (contractId && !current)
    throw new NotFoundException('Contrato não encontrado');

  const data: MemberContractData = {
    ...(dto.type !== undefined ? { type: dto.type } : {}),
    ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
    ...(dto.startDate !== undefined
      ? { startDate: new Date(dto.startDate) }
      : {}),
    ...(dto.endDate !== undefined
      ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
      : {}),
    ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
  };

  const startDate = data.startDate ?? current?.startDate;
  const endDate = data.endDate !== undefined ? data.endDate : current?.endDate;
  if (startDate && endDate && endDate < startDate) {
    throw new BadRequestException(
      'O fim do contrato não pode ser antes do início',
    );
  }

  return current
    ? memberRepository.updateContract(current.id, data)
    : memberRepository.createContract(memberId, data);
}
