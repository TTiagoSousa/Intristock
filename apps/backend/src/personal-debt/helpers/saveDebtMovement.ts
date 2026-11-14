import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { DebtMovementData } from '../repositories/personal-debt-repository';
import {
  CreateDebtMovementDto,
  UpdateDebtMovementDto,
} from '../dto/personal-debt.dto';
import { syncDebtStatus } from './syncDebtStatus';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Cria (sem `movementId`) ou edita um movimento de uma dívida da pessoa. Num
 * pagamento as partes não passam do valor, e sem a do capital ela é o valor
 * menos os juros e os encargos; um aumento (`charge`) não tem partes nem mês.
 * Cada mês de prestação só se paga uma vez. Depois o estado segue o saldo
 * (`syncDebtStatus`).
 */
export async function saveDebtMovement(
  userId: string,
  movementId: string | null,
  dto: CreateDebtMovementDto | UpdateDebtMovementDto,
  repository: PrismaPersonalDebtRepository,
) {
  if (
    dto.bankAccountId &&
    !(await repository.findUserBankAccount(userId, dto.bankAccountId))
  )
    throw new NotFoundException('Conta bancária não encontrada');

  const current = movementId
    ? await repository.findMovement(userId, movementId)
    : null;
  if (movementId && !current)
    throw new NotFoundException('Movimento não encontrado');
  const debtId = current?.debtId ?? (dto as CreateDebtMovementDto).debtId;
  const kind = current?.kind ?? (dto as CreateDebtMovementDto).kind;
  const debt = await repository.findDebt(userId, debtId);
  if (!debt) throw new NotFoundException('Dívida não encontrada');

  const pick = (value: number | null | undefined, saved: unknown) =>
    value !== undefined
      ? value
      : saved === null || saved === undefined
        ? null
        : Number(saved);
  const amount = dto.amount ?? Number(current?.amount ?? 0);
  let principal = pick(dto.principalPart, current?.principalPart);
  const interest = pick(dto.interestPart, current?.interestPart);
  const fees = pick(dto.feesPart, current?.feesPart);
  const period =
    dto.period !== undefined ? dto.period : (current?.period ?? null);

  if (kind === 'charge') {
    if (principal !== null || interest !== null || fees !== null || period)
      throw new BadRequestException(
        'Um aumento da dívida não tem capital, juros nem mês',
      );
  } else {
    if (principal === null && (interest !== null || fees !== null))
      principal = round(amount - (interest ?? 0) - (fees ?? 0));
    if (principal !== null && principal < 0)
      throw new BadRequestException(
        'Os juros e os encargos passam do valor pago',
      );
    if (round((principal ?? 0) + (interest ?? 0) + (fees ?? 0)) > round(amount))
      throw new BadRequestException('As partes passam do valor pago');
    if (period && kind !== 'installment')
      throw new BadRequestException('Só uma prestação tem mês');
  }
  if (
    period &&
    debt.movements.some(
      (movement) => movement.period === period && movement.id !== movementId,
    )
  )
    throw new ConflictException('A prestação desse mês já está paga');

  const data: DebtMovementData = {
    date: dto.date ? new Date(dto.date) : undefined,
    amount: dto.amount,
    principalPart: principal,
    interestPart: interest,
    feesPart: fees,
    period,
    bankAccountId: dto.bankAccountId,
    notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
  };

  const saved = movementId
    ? await repository.updateMovement(movementId, data)
    : await repository.createMovement({ ...data, debtId, kind });

  await syncDebtStatus(userId, debtId, repository);
  return saved;
}
