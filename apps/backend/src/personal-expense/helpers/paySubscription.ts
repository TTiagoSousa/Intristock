import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { PaySubscriptionDto } from '../dto/subscription.dto';
import { listSubscriptionPeriods } from './listSubscriptionPeriods';

/**
 * Marca um período de uma subscrição como pago (também um que ainda não
 * chegou): grava a despesa com a loja, a categoria e a conta da subscrição, no
 * dia e pelo valor do período, se não se disserem outros. Cada período paga-se
 * uma vez.
 */
export async function paySubscription(
  userId: string,
  subscriptionId: string,
  dto: PaySubscriptionDto,
  repository: PrismaPersonalExpenseRepository,
) {
  const subscription = await repository.findSubscription(
    userId,
    subscriptionId,
  );
  if (!subscription) throw new NotFoundException('Subscrição não encontrada');

  // Uma recorrente paga-se por mês, uma não recorrente de uma vez (`once`)
  if (subscription.recurring === (dto.period === 'once'))
    throw new BadRequestException('A subscrição não cobra nesse período');

  const [year, month] = dto.period.split('-').map(Number);
  const due = subscription.recurring
    ? listSubscriptionPeriods(
        subscription,
        new Date(Date.UTC(year, month - 1, 1)),
        new Date(Date.UTC(year, month, 0)),
      )
    : listSubscriptionPeriods(
        subscription,
        subscription.startDate,
        subscription.startDate,
      );
  const entry = due.find(({ period }) => period === dto.period);
  if (!entry)
    throw new BadRequestException('A subscrição não cobra nesse período');

  if (await repository.findSubscriptionPayment(subscription.id, dto.period))
    throw new ConflictException('Esse período já está pago');

  if (
    dto.bankAccountId &&
    !(await repository.findUserBankAccount(userId, dto.bankAccountId))
  )
    throw new NotFoundException('Conta bancária não encontrada');

  return repository.createExpense(
    userId,
    {
      kind: 'subscription',
      date: dto.date ? new Date(dto.date) : entry.date,
      merchant: subscription.merchant ?? subscription.name,
      description: subscription.name,
      categoryId: subscription.categoryId,
      amount: dto.amount ?? Number(subscription.amount),
      currencyId: subscription.currencyId,
      status: 'paid',
      bankAccountId:
        dto.bankAccountId === undefined
          ? subscription.bankAccountId
          : dto.bankAccountId,
      subscriptionId: subscription.id,
      period: dto.period,
    },
    [],
  );
}
