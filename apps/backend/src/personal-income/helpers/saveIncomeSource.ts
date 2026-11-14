import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { IncomeSourceData } from '../repositories/personal-income-repository';
import {
  CreateIncomeSourceDto,
  UpdateIncomeSourceDto,
} from '../dto/income-source.dto';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Cria (sem `sourceId`) ou edita uma fonte de ganhos. A empresa ligada tem de
 * ser uma que a pessoa vê; o salário, se tiver valor, precisa da moeda.
 */
export async function saveIncomeSource(
  userId: string,
  sourceId: string | null,
  dto: CreateIncomeSourceDto | UpdateIncomeSourceDto,
  repository: PrismaPersonalIncomeRepository,
) {
  const current = sourceId
    ? await repository.findSource(userId, sourceId)
    : null;
  if (sourceId && !current)
    throw new NotFoundException('Fonte de ganhos não encontrada');

  if (
    dto.companyId &&
    !(await repository.findAccessibleCompany(userId, dto.companyId))
  )
    throw new NotFoundException('Empresa não encontrada');

  if (dto.currencyId && !(await repository.findCurrency(dto.currencyId)))
    throw new NotFoundException('Moeda não encontrada');

  const data: IncomeSourceData = {
    name: dto.name?.trim(),
    companyId: dto.companyId,
    grossAmount: dto.grossAmount,
    netAmount: dto.netAmount,
    currencyId: dto.currencyId,
    payDay: dto.payDay,
    paymentsPerYear: dto.paymentsPerYear,
    startDate: toDate(dto.startDate),
    endDate: toDate(dto.endDate),
    notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
    isActive: dto.isActive,
  };

  const merged = {
    grossAmount:
      data.grossAmount !== undefined
        ? data.grossAmount
        : (current?.grossAmount ?? null),
    netAmount:
      data.netAmount !== undefined
        ? data.netAmount
        : (current?.netAmount ?? null),
    currencyId:
      data.currencyId !== undefined
        ? data.currencyId
        : (current?.currencyId ?? null),
    startDate:
      data.startDate !== undefined
        ? data.startDate
        : (current?.startDate ?? null),
    endDate:
      data.endDate !== undefined ? data.endDate : (current?.endDate ?? null),
  };
  if (
    (merged.grossAmount !== null || merged.netAmount !== null) &&
    !merged.currencyId
  )
    throw new BadRequestException('O salário precisa da moeda');
  if (merged.startDate && merged.endDate && merged.endDate < merged.startDate)
    throw new BadRequestException('O fim não pode ser antes do início');

  if (!current)
    return repository.createSource(userId, {
      ...data,
      kind: (dto as CreateIncomeSourceDto).kind,
    });
  return repository.updateSource(current.id, data);
}
