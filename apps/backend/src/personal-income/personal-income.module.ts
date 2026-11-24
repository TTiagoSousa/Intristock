import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { TimeTrackingModule } from 'src/time-tracking/time-tracking.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PersonalIncomeController } from './personal-income.controller';
import { PersonalIncomeService } from './personal-income.service';
import { PrismaPersonalIncomeRepository } from './repositories/prisma/prisma-personal-income-repository';

@Module({
  // As somas convertem pela cotação do dia; as horas por pagar vêm do banco de horas
  // e o aviso de um pagamento da empresa fecha quando o ganho entra pelos Ganhos
  imports: [CurrencyModule, TimeTrackingModule, NotificationModule],
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
