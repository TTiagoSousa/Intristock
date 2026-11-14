import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { SubscriptionData } from '../repositories/personal-expense-repository';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from '../dto/subscription.dto';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

const trimmed = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/**
 * Cria (sem `subscriptionId`) ou edita uma subscrição. Mudar o valor só conta
 * nos pagamentos que se marcarem daí em diante; os já gravados ficam.
 */
export async function saveSubscription(
  userId: string,
  subscriptionId: string | null,
  dto: CreateSubscriptionDto | UpdateSubscriptionDto,
  repository: PrismaPersonalExpenseRepository,
) {
  const current = subscriptionId
    ? await repository.findSubscription(userId, subscriptionId)
    : null;
  if (subscriptionId && !current)
    throw new NotFoundException('Subscrição não encontrada');

  if (dto.currencyId && !(await repository.findCurrency(dto.currencyId)))
    throw new NotFoundException('Moeda não encontrada');
  if (
    dto.bankAccountId &&
    !(await repository.findUserBankAccount(userId, dto.bankAccountId))
  )
    throw new NotFoundException('Conta bancária não encontrada');
  if (
    dto.categoryId &&
    !(await repository.findCategory(userId, dto.categoryId))
  )
    throw new NotFoundException('Categoria não encontrada');

  const data: SubscriptionData = {
    kind: dto.kind,
    name: dto.name?.trim(),
    merchant: trimmed(dto.merchant),
    amount: dto.amount,
    currencyId: dto.currencyId,
    recurring: dto.recurring,
    intervalMonths: dto.intervalMonths,
    billingDay: dto.billingDay,
    startDate: toDate(dto.startDate) ?? undefined,
    endDate: toDate(dto.endDate),
    status: dto.status,
    categoryId: dto.categoryId,
    bankAccountId: dto.bankAccountId,
    notes: trimmed(dto.notes),
  };

  const startDate = data.startDate ?? current?.startDate;
  const endDate =
    data.endDate !== undefined ? data.endDate : (current?.endDate ?? null);
  if (startDate && endDate && endDate < startDate)
    throw new BadRequestException('O fim não pode ser antes do início');

  if (!current) return repository.createSubscription(userId, data);
  return repository.updateSubscription(current.id, data);
}
