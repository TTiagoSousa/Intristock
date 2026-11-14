import { Injectable } from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from './repositories/prisma/prisma-company-payment-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { PrismaBankAccountRepository } from 'src/bank-account/repositories/prisma/prisma-bank-account-repository';
import { PrismaTaxRepository } from 'src/tax/repositories/prisma/prisma-tax-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyStockRepository } from 'src/company-stock/repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyAssetRepository } from 'src/company-asset/repositories/prisma/prisma-company-asset-repository';
import { StorageService } from 'src/storage/storage.service';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyRateRepository } from 'src/currency/repositories/prisma/prisma-currency-rate-repository';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { PaymentRateLookup } from './helpers/resolvePaymentRate';
import { createCompanyPayment } from './helpers/createCompanyPayment';
import { findCompanyPayments } from './helpers/findCompanyPayments';
import { updateCompanyPayment } from './helpers/updateCompanyPayment';
import { deleteCompanyPayment } from './helpers/deleteCompanyPayment';
import { summarizeMonthlyPayments } from './helpers/summarizeMonthlyPayments';
import { MonthlyPaymentsQueryDto } from './dto/monthly-payments-query.dto';
import { PrismaCompanyMemberRepository } from 'src/company-member/repositories/prisma/prisma-company-member-repository';
import { CreateCompanyPaymentDto } from './dto/create-company-payment.dto';
import { FindCompanyPaymentsQueryDto } from './dto/find-company-payments-query.dto';
import { UpdateCompanyPaymentDto } from './dto/update-company-payment.dto';

@Injectable()
export class CompanyPaymentService {
  constructor(
    private readonly companyPaymentRepository: PrismaCompanyPaymentRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly companySupplierRepository: PrismaCompanySupplierRepository,
    private readonly bankAccountRepository: PrismaBankAccountRepository,
    private readonly taxRepository: PrismaTaxRepository,
    private readonly companyItemRepository: PrismaCompanyItemRepository,
    private readonly stockRepository: PrismaCompanyStockRepository,
    private readonly assetRepository: PrismaCompanyAssetRepository,
    private readonly storage: StorageService,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly rateRepository: PrismaCurrencyRateRepository,
    private readonly appSettingService: AppSettingService,
    private readonly memberRepository: PrismaCompanyMemberRepository,
  ) {}

  // Para a taxa de um pagamento noutra moeda: a cotação guardada ou, sem ela,
  // a da API de moedas
  private get rateLookup(): PaymentRateLookup {
    return {
      currencyRepository: this.currencyRepository,
      rateRepository: this.rateRepository,
      apiConfig: () => this.appSettingService.apiConfig('currency'),
    };
  }

  async create(userId: string, companyId: string, dto: CreateCompanyPaymentDto) {
    return createCompanyPayment(
      userId,
      companyId,
      dto,
      this.companyPaymentRepository,
      this.companyRepository,
      this.companySupplierRepository,
      this.bankAccountRepository,
      this.taxRepository,
      this.companyItemRepository,
      this.stockRepository,
      this.rateLookup,
    );
  }

  async findAll(userId: string, companyId: string, query: FindCompanyPaymentsQueryDto) {
    return findCompanyPayments(
      userId,
      companyId,
      query,
      this.companyPaymentRepository,
      this.companyRepository,
    );
  }

  async monthly(
    userId: string,
    companyId: string,
    query: MonthlyPaymentsQueryDto,
  ) {
    return summarizeMonthlyPayments(
      userId,
      companyId,
      query,
      this.companyPaymentRepository,
      this.companyRepository,
      this.memberRepository,
    );
  }

  async update(
    userId: string,
    companyId: string,
    paymentId: string,
    dto: UpdateCompanyPaymentDto,
  ) {
    return updateCompanyPayment(
      userId,
      companyId,
      paymentId,
      dto,
      this.companyPaymentRepository,
      this.companyRepository,
      this.companySupplierRepository,
      this.bankAccountRepository,
      this.companyItemRepository,
      this.stockRepository,
      this.assetRepository,
      this.rateLookup,
    );
  }

  async remove(userId: string, companyId: string, paymentId: string) {
    return deleteCompanyPayment(
      userId,
      companyId,
      paymentId,
      this.companyPaymentRepository,
      this.companyRepository,
      this.stockRepository,
      this.assetRepository,
      this.storage,
    );
  }
}
