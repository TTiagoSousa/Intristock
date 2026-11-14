import { Injectable } from '@nestjs/common';
import { PrismaBankAccountRepository } from './repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaPlatformRepository } from 'src/platform/repositories/prisma/prisma-platform-repository';
import { createBankAccount } from './helpers/createBankAccount';
import { findUserBankAccounts } from './helpers/findUserBankAccounts';
import { findCompanyBankAccounts } from './helpers/findCompanyBankAccounts';
import { updateBankAccount } from './helpers/updateBankAccount';
import { deleteBankAccount } from './helpers/deleteBankAccount';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { CreateCompanyBankAccountDto } from 'src/company/dto/create-company-bank-account.dto';

@Injectable()
export class BankAccountService {
  constructor(
    private readonly bankAccountRepository: PrismaBankAccountRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly platformRepository: PrismaPlatformRepository,
  ) {}

  async create(userId: string, dto: CreateBankAccountDto) {
    return createBankAccount(
      userId,
      dto,
      this.bankAccountRepository,
      this.companyRepository,
      this.currencyRepository,
      this.platformRepository,
    );
  }

  async findAll(userId: string) {
    return findUserBankAccounts(userId, this.bankAccountRepository);
  }

  async findAllByCompany(userId: string, companyId: string) {
    return findCompanyBankAccounts(
      userId,
      companyId,
      this.bankAccountRepository,
      this.companyRepository,
    );
  }
  // O companyId vem do parâmetro da rota, não do body — a mesma regra dos
  // fornecedores e dos pagamentos
  async createForCompany(userId: string, companyId: string, dto: CreateCompanyBankAccountDto) {
    return createBankAccount(
      userId,
      { ...dto, companyId },
      this.bankAccountRepository,
      this.companyRepository,
      this.currencyRepository,
      this.platformRepository,
    );
  }

  async updateForCompany(
    userId: string,
    companyId: string,
    bankAccountId: string,
    dto: UpdateBankAccountDto,
  ) {
    return updateBankAccount(
      userId,
      companyId,
      bankAccountId,
      dto,
      this.bankAccountRepository,
      this.companyRepository,
      this.currencyRepository,
      this.platformRepository,
    );
  }

  async removeForCompany(
    userId: string,
    companyId: string,
    bankAccountId: string,
  ) {
    return deleteBankAccount(
      userId,
      companyId,
      bankAccountId,
      this.bankAccountRepository,
      this.companyRepository,
    );
  }
}
