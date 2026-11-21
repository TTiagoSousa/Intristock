import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CompanyPaymentService } from 'src/company-payment/company-payment.service';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import {
  ExpenseData,
  ExpenseItemData,
} from '../repositories/personal-expense-repository';
import {
  CreatePersonalExpenseDto,
  ExpenseItemDto,
  UpdatePersonalExpenseDto,
} from '../dto/personal-expense.dto';

const round = (value: number) => Math.round(value * 100) / 100;
const logger = new Logger('saveExpense');

/**
 * As linhas de uma compra: cada uma com o produto do catálogo (o indicado, ou o
 * do mesmo nome, ou um novo). A categoria do item é a do produto (na página Itens).
 */
async function buildItems(
  userId: string,
  items: ExpenseItemDto[],
  repository: PrismaPersonalExpenseRepository,
): Promise<ExpenseItemData[]> {
  const built: ExpenseItemData[] = [];
  for (const [position, item] of items.entries()) {
    const name = item.name.trim();
    // Pelo nome, o do catálogo ou um novo, com um trinco por nome (não nascem dois iguais)
    const product = item.productId
      ? await repository.findProduct(userId, item.productId)
      : await repository.findOrCreateProduct(userId, name);
    if (!product) throw new NotFoundException('Produto não encontrado');
    built.push({
      productId: product.id,
      name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: round(item.quantity * item.unitPrice),
      position,
    });
  }
  return built;
}

/**
 * Cria (sem `expenseId`) ou edita uma despesa. Com linhas, o valor é a soma
 * delas. Uma de `company` cria na empresa o recebimento do sócio (com as
 * permissões e as regras de um pagamento normal) e fica ligada a ele.
 */
export async function saveExpense(
  userId: string,
  expenseId: string | null,
  dto: CreatePersonalExpenseDto | UpdatePersonalExpenseDto,
  repository: PrismaPersonalExpenseRepository,
  paymentService: CompanyPaymentService,
) {
  const current = expenseId
    ? await repository.findExpense(userId, expenseId)
    : null;
  if (expenseId && !current)
    throw new NotFoundException('Despesa não encontrada');

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

  const items = dto.items
    ? await buildItems(userId, dto.items, repository)
    : null;
  const amount =
    items && items.length > 0
      ? round(items.reduce((sum, item) => sum + item.amount, 0))
      : dto.amount;

  const data: ExpenseData = {
    date: dto.date ? new Date(dto.date) : undefined,
    merchant:
      dto.merchant === undefined ? undefined : dto.merchant?.trim() || null,
    description:
      dto.description === undefined
        ? undefined
        : dto.description?.trim() || null,
    categoryId: dto.categoryId,
    amount,
    currencyId: dto.currencyId,
    status: dto.status,
    bankAccountId: dto.bankAccountId,
    notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
  };

  if (current) {
    // Uma entrada numa empresa já está lá registada: o valor, a moeda e a data ficam
    if (
      current.companyPaymentId &&
      (amount !== undefined || dto.currencyId || dto.date)
    )
      throw new BadRequestException(
        'O valor, a moeda e a data de uma entrada na empresa mudam-se no pagamento da empresa',
      );
    return repository.updateExpense(current.id, data, items);
  }

  const create = dto as CreatePersonalExpenseDto;
  if (!amount)
    throw new BadRequestException('Diz o valor ou acrescenta linhas');

  if (create.kind === 'company') {
    if (!create.companyId || !create.companyBankAccountId)
      throw new BadRequestException(
        'Escolhe a empresa e a conta dela onde o dinheiro entra',
      );
    if (items && items.length > 0)
      throw new BadRequestException('Uma entrada numa empresa não tem linhas');
    const payment = await paymentService.create(userId, create.companyId, {
      paymentType: 'receive',
      partyType: 'shareholder',
      toBankAccountId: create.companyBankAccountId,
      amount,
      currencyId: create.currencyId,
      paymentDate: create.date,
      description: data.description ?? 'Entrada do sócio',
      status: 'completed',
    } as Parameters<CompanyPaymentService['create']>[2]);
    data.companyId = create.companyId;
    data.companyPaymentId = payment.id;

    // Se a despesa não se grava, o recebimento na empresa sai também: senão ficava lá uma
    // entrada do sócio sem a despesa que a explica (e repetir duplicava-a)
    try {
      return await repository.createExpense(userId, { ...data, kind: create.kind }, []);
    } catch (error) {
      await paymentService
        .discard(create.companyId, payment.id)
        .catch((undo) => logger.error(`Não consegui desfazer o pagamento ${payment.id}: ${String(undo)}`));
      throw error;
    }
  }

  return repository.createExpense(
    userId,
    { ...data, kind: create.kind },
    items ?? [],
  );
}
