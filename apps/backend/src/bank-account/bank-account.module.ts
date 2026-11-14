import { Module } from '@nestjs/common';
import { BankAccountService } from './bank-account.service';
import { BankAccountController } from './bank-account.controller';
import { CompanyBankAccountController } from './company-bank-account.controller';
import { PrismaBankAccountRepository } from './repositories/prisma/prisma-bank-account-repository';
import { CompanyModule } from 'src/company/company.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { PlatformModule } from 'src/platform/platform.module';

@Module({
  imports: [CompanyModule, CurrencyModule, PlatformModule],
  controllers: [BankAccountController, CompanyBankAccountController],
  providers: [
    BankAccountService,
    {
      provide: PrismaBankAccountRepository,
      useClass: PrismaBankAccountRepository,
    },
  ],
  exports: [PrismaBankAccountRepository],
})
export class BankAccountModule {}
