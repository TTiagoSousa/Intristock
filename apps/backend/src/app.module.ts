import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthEmployeeModule } from './auth-employee/auth-employee.module';
import { EmployeeModule } from './employee/employee.module';
import { JobTypeModule } from './job-type/job-type.module';
import { UserModule } from './user/user.module';
import { AuthUserModule } from './auth-user/auth-user.module';
import { CalculatorModule } from './calculator/calculator.module';
import { CalculatorsModule } from './calculators/calculators.module';
import { CurrencyModule } from './currency/currency.module';
import { CountryModule } from './country/country.module';
import { CompanyModule } from './company/company.module';
import { BankAccountModule } from './bank-account/bank-account.module';
import { PlatformModule } from './platform/platform.module';
import { TaxModule } from './tax/tax.module';
import { CompanySupplierModule } from './company-supplier/company-supplier.module';
import { CompanySupplierGroupModule } from './company-supplier-group/company-supplier-group.module';
import { CompanyPaymentModule } from './company-payment/company-payment.module';
import { SystemModuleModule } from './module/module.module';
import { CompanyAccessModule } from './company-access/company-access.module';
import { CompanyMemberModule } from './company-member/company-member.module';
import { PersonalIncomeModule } from './personal-income/personal-income.module';
import { PersonalExpenseModule } from './personal-expense/personal-expense.module';
import { PersonalDebtModule } from './personal-debt/personal-debt.module';
import { PersonalPortfolioModule } from './personal-portfolio/personal-portfolio.module';
import { CompanyModuleModule } from './company-module/company-module.module';
import { CompanyItemModule } from './company-item/company-item.module';
import { CompanyAssetModule } from './company-asset/company-asset.module';
import { CompanyStockModule } from './company-stock/company-stock.module';
import { CompanyPaymentDocumentModule } from './company-payment-document/company-payment-document.module';
import { AppSettingModule } from './app-setting/app-setting.module';
import { CatalogSeedModule } from './catalog-seed/catalog-seed.module';
import { SystemModule } from './system/system.module';
import { MarketDataModule } from './market-data/market-data.module';
import { SimulationModule } from './simulation/simulation.module';
import { LiveTestModule } from './live-test/live-test.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    PrismaModule,
    AuthEmployeeModule,
    EmployeeModule,
    JobTypeModule,
    UserModule,
    AuthUserModule,
    CalculatorModule,
    CalculatorsModule,
    CurrencyModule,
    CountryModule,
    CompanyModule,
    BankAccountModule,
    PlatformModule,
    TaxModule,
    CompanySupplierModule,
    CompanySupplierGroupModule,
    CompanyPaymentModule,
    SystemModuleModule,
    CompanyModuleModule,
    CompanyAccessModule,
    CompanyMemberModule,
    PersonalIncomeModule,
    PersonalExpenseModule,
    PersonalDebtModule,
    PersonalPortfolioModule,
    CompanyItemModule,
    CompanyAssetModule,
    CompanyStockModule,
    CompanyPaymentDocumentModule,
    AppSettingModule,
    CatalogSeedModule,
    SystemModule,
    MarketDataModule,
    SimulationModule,
    LiveTestModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
