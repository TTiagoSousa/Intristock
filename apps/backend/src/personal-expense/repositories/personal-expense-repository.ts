import {
  PersonalExpense,
  PersonalExpenseCategory,
  PersonalItemCategory,
  PersonalProduct,
  PersonalSubscription,
} from 'src/generated/prisma/client/client';

export type ExpenseCurrency = {
  id: string;
  shortCode: string;
  symbol: string;
  rate: number;
};

export type ExpenseItemData = {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  position: number;
};

export type ProductData = {
  name?: string;
  brand?: string | null;
  unit?: string | null;
  categoryId?: string | null;
};

// Uma linha comprada, para as contas de cada produto
export type ProductPurchase = {
  productId: string | null;
  quantity: unknown;
  unitPrice: unknown;
  amount: unknown;
  expense: {
    date: Date;
    status: string;
    currency: ExpenseCurrency;
    rateHour: Date | null;
  };
};

export type ExpenseData = {
  kind?: string;
  date?: Date;
  merchant?: string | null;
  description?: string | null;
  categoryId?: string | null;
  companyId?: string | null;
  companyPaymentId?: string | null;
  amount?: number;
  currencyId?: string;
  status?: string;
  bankAccountId?: string | null;
  subscriptionId?: string | null;
  period?: string | null;
  notes?: string | null;
};

export type SubscriptionData = {
  kind?: string;
  name?: string;
  merchant?: string | null;
  amount?: number;
  currencyId?: string;
  recurring?: boolean;
  intervalMonths?: number;
  billingDay?: number | null;
  startDate?: Date;
  endDate?: Date | null;
  status?: string;
  categoryId?: string | null;
  bankAccountId?: string | null;
  notes?: string | null;
};

export type SubscriptionWithRefs = PersonalSubscription & {
  currency: ExpenseCurrency;
  category: { id: string; name: string; parentId: string | null } | null;
  bankAccount: { id: string; name: string } | null;
};

// Um pagamento já gravado de uma subscrição
export type SubscriptionPayment = {
  id: string;
  subscriptionId: string | null;
  period: string | null;
  date: Date;
  amount: unknown;
  status: string;
};

export type ExpenseFilters = {
  from?: Date;
  to?: Date;
  kind?: string;
  categoryIds?: string[];
  q?: string;
};

type CategoryRef = { id: string; name: string; parentId: string | null };

export type ExpenseWithRefs = PersonalExpense & {
  category: CategoryRef | null;
  company: { id: string; name: string; slug: string } | null;
  currency: ExpenseCurrency;
  bankAccount: { id: string; name: string } | null;
  items: {
    id: string;
    productId: string | null;
    name: string;
    quantity: unknown;
    unitPrice: unknown;
    amount: unknown;
    position: number;
  }[];
};

export interface PersonalExpenseRepository {
  countCategories(userId: string): Promise<number>;
  findCategories(userId: string): Promise<PersonalExpenseCategory[]>;
  findCategory(
    userId: string,
    categoryId: string,
  ): Promise<PersonalExpenseCategory | null>;
  createCategory(
    userId: string,
    name: string,
    parentId: string | null,
  ): Promise<PersonalExpenseCategory>;
  updateCategory(
    categoryId: string,
    data: { name?: string; isActive?: boolean; parentId?: string | null },
  ): Promise<PersonalExpenseCategory>;

  countItemCategories(userId: string): Promise<number>;
  findItemCategories(userId: string): Promise<PersonalItemCategory[]>;
  findItemCategory(
    userId: string,
    categoryId: string,
  ): Promise<PersonalItemCategory | null>;
  createItemCategory(
    userId: string,
    name: string,
    parentId: string | null,
  ): Promise<PersonalItemCategory>;
  updateItemCategory(
    categoryId: string,
    data: { name?: string; isActive?: boolean; parentId?: string | null },
  ): Promise<PersonalItemCategory>;

  findProducts(userId: string): Promise<PersonalProduct[]>;
  findProductPurchases(userId: string): Promise<ProductPurchase[]>;
  findProduct(
    userId: string,
    productId: string,
  ): Promise<PersonalProduct | null>;
  findProductByName(
    userId: string,
    name: string,
  ): Promise<PersonalProduct | null>;
  createProduct(userId: string, data: ProductData): Promise<PersonalProduct>;
  updateProduct(productId: string, data: ProductData): Promise<PersonalProduct>;

  findExpenses(
    userId: string,
    filters: ExpenseFilters,
  ): Promise<ExpenseWithRefs[]>;
  findExpense(
    userId: string,
    expenseId: string,
  ): Promise<PersonalExpense | null>;
  createExpense(
    userId: string,
    data: ExpenseData,
    items: ExpenseItemData[],
  ): Promise<PersonalExpense>;
  // `items` nulo deixa as linhas como estão
  updateExpense(
    expenseId: string,
    data: ExpenseData,
    items: ExpenseItemData[] | null,
  ): Promise<PersonalExpense>;
  deleteExpense(expenseId: string): Promise<void>;

  findSubscriptions(userId: string): Promise<SubscriptionWithRefs[]>;
  findSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<SubscriptionWithRefs | null>;
  createSubscription(
    userId: string,
    data: SubscriptionData,
  ): Promise<PersonalSubscription>;
  updateSubscription(
    subscriptionId: string,
    data: SubscriptionData,
  ): Promise<PersonalSubscription>;
  // As despesas que pagou ficam (sem a ligação)
  deleteSubscription(subscriptionId: string): Promise<void>;
  findSubscriptionPayments(userId: string): Promise<SubscriptionPayment[]>;
  findSubscriptionPayment(
    subscriptionId: string,
    period: string,
  ): Promise<SubscriptionPayment | null>;

  findCurrency(currencyId: string): Promise<ExpenseCurrency | null>;
  findCurrencyByCode(shortCode: string): Promise<ExpenseCurrency | null>;
  findUserBankAccount(
    userId: string,
    bankAccountId: string,
  ): Promise<{ id: string } | null>;
}
