import { Injectable, Logger } from '@nestjs/common';
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
import { CompanyInvitationService } from 'src/company-invitation/company-invitation.service';

@Injectable()
export class CompanyPaymentService {
  private readonly logger = new Logger(CompanyPaymentService.name);

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
    private readonly invitations: CompanyInvitationService,
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

  /** `skipMemberHook`: quem chama trata do aviso à pessoa (os pagamentos das horas). */
  async create(
    userId: string,
    companyId: string,
    dto: CreateCompanyPaymentDto,
    options: { skipMemberHook?: boolean } = {},
  ) {
    const payment = await createCompanyPayment(
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
    // A um membro com conta: confirma que recebeu (ou, se pagou a si próprio, o ganho entra já)
    if (dto.partyType === 'member' && !options.skipMemberHook) await this.notifyMemberPaid(payment.id, userId);
    return payment;
  }

  /**
   * O aviso ao membro (ou o ganho, se se pagou a si próprio) não desfaz o pagamento: se falhar,
   * o pagamento já está gravado e dar erro levava a repeti-lo (e a duplicá-lo). Fica no registo.
   */
  private async notifyMemberPaid(paymentId: string, userId: string) {
    try {
      await this.invitations.memberPaid(paymentId, userId);
    } catch (error) {
      this.logger.error(`O aviso do pagamento ${paymentId} ao membro falhou: ${String(error)}`);
    }
  }

  /**
   * Apaga um pagamento acabado de criar por outro módulo quando o que vinha a seguir falhou
   * (uma despesa pessoal que não se gravou). Sem as permissões do apagar normal: quem o criou
   * pode desfazê-lo. Recusa se ele já tem ativos (a FK não deixa).
   */
  async discard(companyId: string, paymentId: string) {
    const removed = await this.companyPaymentRepository.discard(companyId, paymentId);
    if (removed) await this.invitations.memberPaymentRemoved(paymentId);
    return removed;
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
    const { payment, becameSettled } = await updateCompanyPayment(
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
    // Um pagamento a um membro que passa a concluído pede-lhe a confirmação, como ao criar
    if (becameSettled && payment.partyType === 'member') await this.notifyMemberPaid(payment.id, userId);
    // Deixou de estar concluído: o pedido de confirmação deixa de fazer sentido
    if (payment.partyType === 'member' && payment.status !== 'completed')
      await this.invitations.memberPaymentRemoved(payment.id);
    return payment;
  }

  async remove(userId: string, companyId: string, paymentId: string) {
    const result = await deleteCompanyPayment(
      userId,
      companyId,
      paymentId,
      this.companyPaymentRepository,
      this.companyRepository,
      this.stockRepository,
      this.assetRepository,
      this.storage,
    );
    // Se a pessoa ainda não tinha confirmado, o aviso deixa de pedir resposta
    await this.invitations.memberPaymentRemoved(paymentId);
    return result;
  }
}
