import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BankAccountRepository,
  BankAccountUpdateData,
} from '../bank-account-repository';
import { AccountMovementTotals } from '../../helpers/calculateAccountBalances';
import { BankAccount } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaBankAccountRepository implements BankAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId?: string;
    companyId?: string;
    name: string;
    iban?: string;
    currencyId: string;
    platformId: string;
    initialBalance?: number;
  }): Promise<BankAccount> {
    return this.prisma.bankAccount.create({ data });
  }

  async findById(id: string): Promise<BankAccount | null> {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  async findAllByUserId(userId: string): Promise<BankAccount[]> {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByCompanyId(companyId: string): Promise<BankAccount[]> {
    return this.prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * O que entrou e o que saiu de cada conta, somado pelo Postgres, na moeda da
   * conta.
   *
   * Uma conta está na moeda do pagamento (conta o valor) ou na da empresa
   * (conta o valor × a taxa) — o pagamento não aceita outra. Daí o CASE, e daí
   * não dar para o `groupBy`. Origem e destino somam-se à parte: a mesma conta
   * pode ser origem de um pagamento e destino de outro. Só entram os
   * pagamentos concluídos — um rascunho ainda não saiu do banco.
   */
  async sumMovementsByCompany(companyId: string): Promise<AccountMovementTotals[]> {
    const rows = await this.prisma.$queryRaw<
      {
        bankAccountId: string;
        credited: string | null;
        debited: string | null;
      }[]
    >`
      SELECT account.id AS "bankAccountId",
             SUM(CASE WHEN payment."toBankAccountId" = account.id THEN
                   CASE WHEN account."currencyId" = payment."currencyId" THEN payment.amount
                        ELSE ROUND(payment.amount * payment."exchangeRate", 2) END
                 END)::text AS credited,
             SUM(CASE WHEN payment."fromBankAccountId" = account.id THEN
                   CASE WHEN account."currencyId" = payment."currencyId" THEN payment.amount
                        ELSE ROUND(payment.amount * payment."exchangeRate", 2) END
                 END)::text AS debited
        FROM "CompanyPayment" payment
        JOIN "BankAccount" account
          ON account.id IN (payment."fromBankAccountId", payment."toBankAccountId")
       WHERE payment."companyId" = ${companyId}
         AND payment.status = 'completed'
       GROUP BY account.id`;

    return rows.map((row) => ({
      bankAccountId: row.bankAccountId,
      credited: Number(row.credited ?? 0),
      debited: Number(row.debited ?? 0),
    }));
  }

  async findByIban(iban: string): Promise<BankAccount | null> {
    return this.prisma.bankAccount.findUnique({ where: { iban } });
  }
  async update(id: string, data: BankAccountUpdateData): Promise<BankAccount> {
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bankAccount.delete({ where: { id } });
  }

  // Origem e destino contam as duas: a conta está presa por qualquer uma delas
  async countPayments(bankAccountId: string): Promise<number> {
    return this.prisma.companyPayment.count({
      where: {
        OR: [
          { fromBankAccountId: bankAccountId },
          { toBankAccountId: bankAccountId },
        ],
      },
    });
  }

  async countSuppliers(bankAccountId: string): Promise<number> {
    return this.prisma.companySupplier.count({ where: { bankAccountId } });
  }
}
