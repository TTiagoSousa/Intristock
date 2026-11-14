import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { PersonalIncomeController } from './personal-income.controller';
import { PersonalIncomeService } from './personal-income.service';
import { PrismaPersonalIncomeRepository } from './repositories/prisma/prisma-personal-income-repository';

@Module({
  // As somas convertem pela cotação do dia
  imports: [CurrencyModule],
  controllers: [PersonalIncomeController],
  providers: [
    PersonalIncomeService,
    {
      provide: PrismaPersonalIncomeRepository,
      useClass: PrismaPersonalIncomeRepository,
    },
  ],
})
export class PersonalIncomeModule {}
