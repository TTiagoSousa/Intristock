import {
  PersonalDebt,
  PersonalDebtMovement,
} from 'src/generated/prisma/client/client';

export type DebtCurrency = {
  id: string;
  shortCode: string;
  symbol: string;
  rate: number;
};

export type DebtWithRefs = PersonalDebt & {
  currency: DebtCurrency;
  platform: { id: string; name: string; logo: string | null } | null;
  bankAccount: { id: string; name: string } | null;
  movements: PersonalDebtMovement[];
};

export type DebtMovementWithRefs = PersonalDebtMovement & {
  debt: {
    id: string;
    name: string;
    kind: string;
    direction: string;
    currency: DebtCurrency;
  };
  bankAccount: { id: string; name: string } | null;
};

type Money = number | null;

export type DebtData = Partial<
  Omit<
    PersonalDebt,
    | 'id'
    | 'userId'
    | 'createdAt'
    | 'updatedAt'
    | 'principal'
    | 'openingBalance'
    | 'interestRate'
    | 'installment'
  >
> & {
  principal?: number;
  openingBalance?: number;
  interestRate?: Money;
  installment?: Money;
};

export type DebtMovementData = Partial<
  Omit<
    PersonalDebtMovement,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'amount'
    | 'principalPart'
    | 'interestPart'
    | 'feesPart'
  >
> & {
  amount?: number;
  principalPart?: Money;
  interestPart?: Money;
  feesPart?: Money;
};

export type DebtMovementFilters = {
  debtId?: string;
  kind?: string;
  from?: Date;
  to?: Date;
};

export interface PersonalDebtRepository {
  findDebts(userId: string): Promise<DebtWithRefs[]>;
  findDebt(userId: string, debtId: string): Promise<DebtWithRefs | null>;
  createDebt(userId: string, data: DebtData): Promise<PersonalDebt>;
  updateDebt(debtId: string, data: DebtData): Promise<PersonalDebt>;
  deleteDebt(debtId: string): Promise<void>;

  findMovements(
    userId: string,
    filters: DebtMovementFilters,
  ): Promise<DebtMovementWithRefs[]>;
  findMovement(
    userId: string,
    movementId: string,
  ): Promise<PersonalDebtMovement | null>;
  createMovement(data: DebtMovementData): Promise<PersonalDebtMovement>;
  updateMovement(
    movementId: string,
    data: DebtMovementData,
  ): Promise<PersonalDebtMovement>;
  deleteMovement(movementId: string): Promise<void>;

  findCurrency(currencyId: string): Promise<DebtCurrency | null>;
  findCurrencyByCode(shortCode: string): Promise<DebtCurrency | null>;
  findUserBankAccount(
    userId: string,
    bankAccountId: string,
  ): Promise<{ id: string } | null>;
  findBank(platformId: string): Promise<{ id: string } | null>;
}
