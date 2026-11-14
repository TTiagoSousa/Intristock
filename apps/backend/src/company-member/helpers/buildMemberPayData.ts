import { BadRequestException } from '@nestjs/common';
import { CompanyMemberPay } from 'src/generated/prisma/client/client';
import { MemberPayData } from '../repositories/company-member-repository';
import {
  CreateMemberPayDto,
  MemberPayKind,
  UpdateMemberPayDto,
} from '../dto/member-pay.dto';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * O que se grava de um salário ou recibo verde, só com os campos do tipo dele,
 * e confirmado já com o que estava (a editar): um salário precisa do dia, das
 * vezes por ano e do início, e o fim não vem antes do início; um recibo verde
 * precisa da data.
 */
export function buildMemberPayData(
  kind: MemberPayKind,
  dto: CreateMemberPayDto | UpdateMemberPayDto,
  current?: CompanyMemberPay,
): MemberPayData {
  const common: MemberPayData = {
    ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
    ...(dto.description !== undefined
      ? { description: dto.description?.trim() || null }
      : {}),
    ...(dto.grossAmount !== undefined ? { grossAmount: dto.grossAmount } : {}),
  };

  if (kind === 'freelance') {
    const dueDate = toDate(dto.dueDate) ?? current?.dueDate;
    if (!dueDate)
      throw new BadRequestException(
        'Um recibo verde precisa da data do pagamento',
      );
    return {
      ...common,
      ...(dto.dueDate !== undefined ? { dueDate } : {}),
      ...(dto.withholdingPct !== undefined
        ? { withholdingPct: dto.withholdingPct }
        : {}),
    };
  }

  const startDate = toDate(dto.startDate) ?? current?.startDate;
  const endDate =
    dto.endDate !== undefined ? toDate(dto.endDate) : current?.endDate;
  const payDay = dto.payDay ?? current?.payDay;
  const paymentsPerYear = dto.paymentsPerYear ?? current?.paymentsPerYear ?? 14;

  if (!startDate)
    throw new BadRequestException('Um salário precisa da data de início');
  if (!payDay)
    throw new BadRequestException('Um salário precisa do dia do pagamento');
  if (endDate && endDate < startDate) {
    throw new BadRequestException(
      'O fim do salário não pode ser antes do início',
    );
  }

  return {
    ...common,
    startDate,
    endDate: endDate ?? null,
    payDay,
    paymentsPerYear,
  };
}
