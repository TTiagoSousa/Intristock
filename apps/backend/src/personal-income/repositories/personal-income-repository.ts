import {
  CompanyMember,
  CompanyMemberPay,
  PersonalIncome,
  PersonalIncomeSource,
} from 'src/generated/prisma/client/client';

export type IncomeCurrency = {
  id: string;
  shortCode: string;
  symbol: string;
  rate: number;
};

type CompanyRef = { id: string; name: string; slug: string };

export type IncomeSourceWithRefs = PersonalIncomeSource & {
  company: CompanyRef | null;
  currency: IncomeCurrency | null;
  _count: { incomes: number };
};

export type IncomeWithRefs = PersonalIncome & {
  source: { id: string; name: string; kind: string } | null;
  currency: IncomeCurrency;
  bankAccount: { id: string; name: string } | null;
  memberPay: {
    id: string;
    kind: string;
    member: { company: CompanyRef };
  } | null;
};

// Um salário ou recibo verde que uma empresa da base paga a esta pessoa (ela é o membro)
export type UserMemberPay = CompanyMemberPay & {
  member: Pick<CompanyMember, 'id' | 'name' | 'bankAccountId'> & {
    user: { fullName: string } | null;
    currency: IncomeCurrency | null;
    company: CompanyRef & { currency: IncomeCurrency };
  };
};

export type IncomeSourceData = Partial<
  Omit<
    PersonalIncomeSource,
    'id' | 'userId' | 'createdAt' | 'updatedAt' | 'grossAmount' | 'netAmount'
  >
> & { grossAmount?: number | null; netAmount?: number | null };

export type IncomeData = Partial<
  Omit<
    PersonalIncome,
    | 'id'
    | 'userId'
    | 'createdAt'
    | 'updatedAt'
    | 'grossAmount'
    | 'amount'
    | 'withholdingPct'
  >
> & {
  grossAmount?: number | null;
  amount?: number;
  withholdingPct?: number | null;
};

export type IncomeFilters = {
  from?: Date;
  to?: Date;
  kind?: string;
  sourceId?: string;
  status?: string;
};

export interface PersonalIncomeRepository {
  findSources(userId: string): Promise<IncomeSourceWithRefs[]>;
  findSource(
    userId: string,
    sourceId: string,
  ): Promise<IncomeSourceWithRefs | null>;
  createSource(
    userId: string,
    data: IncomeSourceData,
  ): Promise<PersonalIncomeSource>;
  updateSource(
    sourceId: string,
    data: IncomeSourceData,
  ): Promise<PersonalIncomeSource>;
  deleteSource(sourceId: string): Promise<void>;

  findIncomes(
    userId: string,
    filters: IncomeFilters,
  ): Promise<IncomeWithRefs[]>;
  findIncome(userId: string, incomeId: string): Promise<PersonalIncome | null>;
  createIncome(userId: string, data: IncomeData): Promise<PersonalIncome>;
  updateIncome(incomeId: string, data: IncomeData): Promise<PersonalIncome>;
  deleteIncome(incomeId: string): Promise<void>;
  // `sourceId|período` e `memberPayId|período` dos já registados
  findRecordedPeriods(userId: string): Promise<Set<string>>;

  findUserMemberPays(userId: string): Promise<UserMemberPay[]>;
  findUserMemberPay(
    userId: string,
    payId: string,
  ): Promise<UserMemberPay | null>;
  // `payId|período` dos que a empresa já registou como pagos
  findCompanyPaidPeriods(payIds: string[]): Promise<Set<string>>;

  findCurrency(currencyId: string): Promise<IncomeCurrency | null>;
  findCurrencyByCode(shortCode: string): Promise<IncomeCurrency | null>;
  findUserBankAccount(
    userId: string,
    bankAccountId: string,
  ): Promise<{ id: string } | null>;
  findAccessibleCompany(
    userId: string,
    companyId: string,
  ): Promise<{ id: string } | null>;
  findAccessibleCompanies(userId: string): Promise<CompanyRef[]>;
}
