import { Module } from '@nestjs/common';
import { CompanyPaymentModule } from 'src/company-payment/company-payment.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { PersonalExpenseController } from './personal-expense.controller';
import { PersonalExpenseService } from './personal-expense.service';
import { PrismaPersonalExpenseRepository } from './repositories/prisma/prisma-personal-expense-repository';

@Module({
  // O dinheiro posto numa empresa entra lá como recebimento do sócio; as somas convertem pela cotação do dia
  imports: [CompanyPaymentModule, CurrencyModule],
  controllers: [PersonalExpenseController],
  providers: [
    PersonalExpenseService,
    {
      provide: PrismaPersonalExpenseRepository,
      useClass: PrismaPersonalExpenseRepository,
    },
  ],
})
export class PersonalExpenseModule {}
