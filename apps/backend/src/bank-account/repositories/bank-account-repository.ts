import { BankAccount } from 'src/generated/prisma/client/client';
import { AccountMovementTotals } from '../helpers/calculateAccountBalances';

export interface BankAccountUpdateData {
  name?: string;
  iban?: string | null;
  platformId?: string;
  currencyId?: string;
  initialBalance?: number;
  status?: string;
}

export interface BankAccountRepository {
  create(data: {
    userId?: string;
    companyId?: string;
    name: string;
    iban?: string;
    currencyId: string;
    platformId: string;
    initialBalance?: number;
  }): Promise<BankAccount>;
  findById(id: string): Promise<BankAccount | null>;
  findAllByUserId(userId: string): Promise<BankAccount[]>;
  findAllByCompanyId(companyId: string): Promise<BankAccount[]>;
  // O movimento de cada conta da empresa, somado na base de dados em vez de
  // trazer os pagamentos todos para memória
  sumMovementsByCompany(companyId: string): Promise<AccountMovementTotals[]>;
  findByOwnerIban(
    owner: { userId?: string; companyId?: string },
    iban: string,
  ): Promise<BankAccount | null>;
  update(id: string, data: BankAccountUpdateData): Promise<BankAccount>;
  delete(id: string): Promise<void>;
  // Guardas de quem depende desta conta antes de a apagar ou lhe trocar a moeda
  countPayments(bankAccountId: string): Promise<number>;
  countSuppliers(bankAccountId: string): Promise<number>;
}
