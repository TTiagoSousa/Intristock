import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { DebtData } from '../repositories/personal-debt-repository';
import {
  CreatePersonalDebtDto,
  UpdatePersonalDebtDto,
} from '../dto/personal-debt.dto';
import { presentDebt } from './presentDebt';

const trimmed = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/**
 * Cria (sem `debtId`) ou edita uma dívida. Ao criar sem `openingBalance`, o
 * que falta pagar é o montante todo, na data de início. O banco tem de ser uma
 * plataforma do tipo banco e a conta da pessoa; o fim não vem antes do início.
 */
export async function saveDebt(
  userId: string,
  debtId: string | null,
  dto: CreatePersonalDebtDto | UpdatePersonalDebtDto,
  repository: PrismaPersonalDebtRepository,
) {
  if (dto.currencyId && !(await repository.findCurrency(dto.currencyId)))
    throw new NotFoundException('Moeda não encontrada');
  if (dto.platformId && !(await repository.findBank(dto.platformId)))
    throw new NotFoundException('Banco não encontrado');
  if (
    dto.bankAccountId &&
    !(await repository.findUserBankAccount(userId, dto.bankAccountId))
  )
    throw new NotFoundException('Conta bancária não encontrada');
  if (dto.name !== undefined && !dto.name.trim())
    throw new BadRequestException('A dívida precisa de um nome');

  const data: DebtData = {
    direction: dto.direction,
    kind: dto.kind,
    name: dto.name?.trim(),
    counterparty: trimmed(dto.counterparty),
    platformId: dto.platformId,
    currencyId: dto.currencyId,
    principal: dto.principal,
    openingBalance: dto.openingBalance,
    openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
    interestRate: dto.interestRate,
    rateType: dto.rateType,
    installment: dto.installment,
    paymentDay: dto.paymentDay,
    startDate: dto.startDate ? new Date(dto.startDate) : undefined,
    endDate:
      dto.endDate === undefined
        ? undefined
        : dto.endDate
          ? new Date(dto.endDate)
          : null,
    bankAccountId: dto.bankAccountId,
    status: dto.status,
    notes: trimmed(dto.notes),
  };

  let saved: string;
  if (debtId) {
    const current = await repository.findDebt(userId, debtId);
    if (!current) throw new NotFoundException('Dívida não encontrada');
    const start = data.startDate ?? current.startDate;
    const end = data.endDate === undefined ? current.endDate : data.endDate;
    if (end && end < start)
      throw new BadRequestException('O fim não pode ser antes do início');
    await repository.updateDebt(debtId, data);
    saved = debtId;
  } else {
    const create = dto as CreatePersonalDebtDto;
    if (data.endDate && data.startDate && data.endDate < data.startDate)
      throw new BadRequestException('O fim não pode ser antes do início');
    if (create.openingBalance === undefined) {
      data.openingBalance = create.principal;
      data.openingDate = data.startDate;
    } else if (!data.openingDate) {
      data.openingDate = new Date(new Date().toISOString().slice(0, 10));
    }
    saved = (await repository.createDebt(userId, data)).id;
  }

  const debt = await repository.findDebt(userId, saved);
  return debt && presentDebt(debt, new Date().toISOString().slice(0, 10));
}
