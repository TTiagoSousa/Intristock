import { Module } from '@nestjs/common';
import { CompanyPaymentService } from './company-payment.service';
import { CompanyPaymentController } from './company-payment.controller';
import { PrismaCompanyPaymentRepository } from './repositories/prisma/prisma-company-payment-repository';
import { CompanyModule } from 'src/company/company.module';
import { CompanySupplierModule } from 'src/company-supplier/company-supplier.module';
import { BankAccountModule } from 'src/bank-account/bank-account.module';
import { TaxModule } from 'src/tax/tax.module';
import { CompanyItemModule } from 'src/company-item/company-item.module';
import { CompanyStockModule } from 'src/company-stock/company-stock.module';
import { CompanyAssetModule } from 'src/company-asset/company-asset.module';
import { StorageModule } from 'src/storage/storage.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { CompanyMemberModule } from 'src/company-member/company-member.module';

@Module({
  imports: [
    CompanyModule,
    CompanySupplierModule,
    BankAccountModule,
    TaxModule,
    CompanyItemModule,
    // Uma venda tira do stock e apagar uma compra devolve-o: as duas coisas
    // precisam de saber o saldo antes de mexer
    CompanyStockModule,
    // Uma compra não se apaga enquanto os ativos que criou existirem
    CompanyAssetModule,
    // Apagar um pagamento tem de levar atrás os ficheiros dos documentos
    StorageModule,
    // Um pagamento noutra moeda guarda a cotação do dia, que vem da tabela ou
    // da API de moedas configurada pelo admin
    CurrencyModule,
    AppSettingModule,
    // Os salários por pagar entram na previsão do gráfico por mês
    CompanyMemberModule,
  ],
  controllers: [CompanyPaymentController],
  providers: [
    CompanyPaymentService,
    {
      provide: PrismaCompanyPaymentRepository,
      useClass: PrismaCompanyPaymentRepository,
    },
  ],
  // As despesas pessoais criam o recebimento do sócio quando se põe dinheiro numa empresa
  exports: [PrismaCompanyPaymentRepository, CompanyPaymentService],
})
export class CompanyPaymentModule {}
