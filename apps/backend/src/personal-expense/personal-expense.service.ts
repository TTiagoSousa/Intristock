import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyPaymentService } from 'src/company-payment/company-payment.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalExpenseRepository } from './repositories/prisma/prisma-personal-expense-repository';
import {
  CreateExpenseCategoryDto,
  CreateItemCategoryDto,
  CreatePersonalExpenseDto,
  CreateProductDto,
  ExpenseSummaryQueryDto,
  ExpensesQueryDto,
  ProductsQueryDto,
  UpdateExpenseCategoryDto,
  UpdateItemCategoryDto,
  UpdatePersonalExpenseDto,
  UpdateProductDto,
} from './dto/personal-expense.dto';
import {
  CreateSubscriptionDto,
  PaySubscriptionDto,
  SubscriptionPeriodsQueryDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';
import { ensureDefaultCategories } from './helpers/ensureDefaultCategories';
import { addDefaultCategories } from './helpers/addDefaultCategories';
import { saveExpenseCategory } from './helpers/saveExpenseCategory';
import { ensureDefaultItemCategories } from './helpers/ensureDefaultItemCategories';
import { saveItemCategory } from './helpers/saveItemCategory';
import { findProducts } from './helpers/findProducts';
import { saveProduct } from './helpers/saveProduct';
import { saveExpense } from './helpers/saveExpense';
import { findExpenses } from './helpers/findExpenses';
import { summarizeExpenses } from './helpers/summarizeExpenses';
import { findSubscriptions } from './helpers/findSubscriptions';
import { saveSubscription } from './helpers/saveSubscription';
import { paySubscription } from './helpers/paySubscription';

/**
 * As despesas de cada pessoa (finanças pessoais): as categorias das despesas e
 * as dos itens (cada uma numa árvore sem limite de níveis), os itens, as
 * despesas com as linhas, as subscrições e o resumo do dashboard. Cada um só
 * vê as suas.
 */
@Injectable()
export class PersonalExpenseService {
  constructor(
    private readonly repository: PrismaPersonalExpenseRepository,
    private readonly paymentService: CompanyPaymentService,
    private readonly currencyService: CurrencyService,
  ) {}

  async findCategories(userId: string) {
    await ensureDefaultCategories(userId, this.repository);
    return this.repository.findCategories(userId);
  }

  saveCategory(
    userId: string,
    categoryId: string | null,
    dto: CreateExpenseCategoryDto | UpdateExpenseCategoryDto,
  ) {
    return saveExpenseCategory(userId, categoryId, dto, this.repository);
  }

  // As por omissão que faltam (as da pessoa ficam como estão)
  addDefaultCategories(userId: string) {
    return addDefaultCategories(userId, this.repository);
  }

  async findItemCategories(userId: string) {
    await ensureDefaultItemCategories(userId, this.repository);
    return this.repository.findItemCategories(userId);
  }

  saveItemCategory(
    userId: string,
    categoryId: string | null,
    dto: CreateItemCategoryDto | UpdateItemCategoryDto,
  ) {
    return saveItemCategory(userId, categoryId, dto, this.repository);
  }

  findProducts(userId: string, query: ProductsQueryDto) {
    return findProducts(userId, query, this.repository, this.currencyService);
  }

  saveProduct(
    userId: string,
    productId: string | null,
    dto: CreateProductDto | UpdateProductDto,
  ) {
    return saveProduct(userId, productId, dto, this.repository);
  }

  findExpenses(userId: string, query: ExpensesQueryDto) {
    return findExpenses(userId, query, this.repository);
  }

  saveExpense(
    userId: string,
    expenseId: string | null,
    dto: CreatePersonalExpenseDto | UpdatePersonalExpenseDto,
  ) {
    return saveExpense(
      userId,
      expenseId,
      dto,
      this.repository,
      this.paymentService,
    );
  }

  // O recebimento que uma entrada numa empresa criou fica lá (cancela-se na empresa)
  async deleteExpense(userId: string, expenseId: string) {
    if (!(await this.repository.findExpense(userId, expenseId)))
      throw new NotFoundException('Despesa não encontrada');
    await this.repository.deleteExpense(expenseId);
  }

  findSubscriptions(userId: string, query: SubscriptionPeriodsQueryDto) {
    return findSubscriptions(
      userId,
      query,
      this.repository,
      this.currencyService,
    );
  }

  saveSubscription(
    userId: string,
    subscriptionId: string | null,
    dto: CreateSubscriptionDto | UpdateSubscriptionDto,
  ) {
    return saveSubscription(userId, subscriptionId, dto, this.repository);
  }

  // Os pagamentos já gravados ficam como despesas, sem a ligação
  async deleteSubscription(userId: string, subscriptionId: string) {
    if (!(await this.repository.findSubscription(userId, subscriptionId)))
      throw new NotFoundException('Subscrição não encontrada');
    await this.repository.deleteSubscription(subscriptionId);
  }

  paySubscription(
    userId: string,
    subscriptionId: string,
    dto: PaySubscriptionDto,
  ) {
    return paySubscription(userId, subscriptionId, dto, this.repository);
  }

  // Desfazer um pago: apaga a despesa desse período, que volta a estar por pagar
  async unpaySubscription(
    userId: string,
    subscriptionId: string,
    period: string,
  ) {
    if (!(await this.repository.findSubscription(userId, subscriptionId)))
      throw new NotFoundException('Subscrição não encontrada');
    const payment = await this.repository.findSubscriptionPayment(
      subscriptionId,
      period,
    );
    if (!payment) throw new NotFoundException('Esse período não está pago');
    await this.repository.deleteExpense(payment.id);
  }

  async summarize(userId: string, query: ExpenseSummaryQueryDto) {
    await ensureDefaultCategories(userId, this.repository);
    await ensureDefaultItemCategories(userId, this.repository);
    return summarizeExpenses(
      userId,
      query,
      this.repository,
      this.currencyService,
    );
  }
}
