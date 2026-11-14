import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { PersonalDebtController } from './personal-debt.controller';
import { PersonalDebtService } from './personal-debt.service';
import { PrismaPersonalDebtRepository } from './repositories/prisma/prisma-personal-debt-repository';

@Module({
  // As somas convertem pela cotação do dia
  imports: [CurrencyModule],
  controllers: [PersonalDebtController],
  providers: [
    PersonalDebtService,
    {
      provide: PrismaPersonalDebtRepository,
      useClass: PrismaPersonalDebtRepository,
    },
  ],
})
export class PersonalDebtModule {}
