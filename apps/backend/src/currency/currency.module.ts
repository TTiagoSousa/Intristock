import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { PrismaCurrencyRepository } from './repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyRateRepository } from './repositories/prisma/prisma-currency-rate-repository';
import { PrismaCurrencyHourRateRepository } from './repositories/prisma/prisma-currency-hour-rate-repository';
import { CurrencyHourRateService } from './currency-hour-rate.service';
import { CurrencyRateFillService } from './currency-rate-fill.service';
import { AppSettingModule } from 'src/app-setting/app-setting.module';

@Module({
  // A chave e o endereço da API vêm das definições guardadas pelo admin
  imports: [AppSettingModule],
  controllers: [CurrencyController],
  providers: [
    CurrencyService,
    // As cotações de hora a hora das moedas do site
    CurrencyHourRateService,
    // A fila das cotações do dia que faltam (pedidas à API fora dos pedidos)
    CurrencyRateFillService,
    PrismaCurrencyHourRateRepository,
    {
      provide: PrismaCurrencyRepository,
      useClass: PrismaCurrencyRepository,
    },
    {
      provide: PrismaCurrencyRateRepository,
      useClass: PrismaCurrencyRateRepository,
    },
  ],
  // Os pagamentos noutra moeda vão buscar a cotação do dia; as finanças pessoais convertem pelo `CurrencyService`
  exports: [
    PrismaCurrencyRepository,
    PrismaCurrencyRateRepository,
    CurrencyService,
  ],
})
export class CurrencyModule {}
