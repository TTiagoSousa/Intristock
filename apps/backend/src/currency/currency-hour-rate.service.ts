import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { PrismaCurrencyRepository } from './repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyHourRateRepository } from './repositories/prisma/prisma-currency-hour-rate-repository';
import { saveCurrentHourRates } from './helpers/saveCurrentHourRates';
import { backfillDailyHourRates } from './helpers/backfillDailyHourRates';

// De quanto em quanto tempo se vê se a hora em que estamos já tem cotações:
// pede-se uma vez por hora, logo nos primeiros minutos dela
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Guarda de hora a hora as cotações das moedas do site (`CurrencyHourRate`) e,
 * para trás até à primeira transação de um portefólio, uma por dia.
 * Os registos das finanças pessoais ficam com a hora em que se gravaram e
 * convertem-se por ela, sem ir à API.
 */
@Injectable()
export class CurrencyHourRateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyHourRateService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly hourRateRepository: PrismaCurrencyHourRateRepository,
    private readonly appSettingService: AppSettingService,
  ) {}

  onModuleInit() {
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async check() {
    if (this.running) return;
    this.running = true;
    try {
      const apiConfig = () => this.appSettingService.apiConfig('currency');
      await saveCurrentHourRates(
        this.currencyRepository,
        this.hourRateRepository,
        apiConfig,
      );
      // Para trás, desde a primeira transação de um portefólio: um por dia
      const days = await backfillDailyHourRates(
        this.currencyRepository,
        this.hourRateRepository,
        apiConfig,
      );
      if (days) this.logger.log(`Cotações de ${days} dias para trás guardadas`);
    } catch (error) {
      // Por configurar ou em baixo: tenta-se outra vez na volta seguinte
      this.logger.warn(`Cotações por guardar: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
