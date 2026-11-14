import { Injectable } from '@nestjs/common';
import { PrismaCurrencyRepository } from './repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyRateRepository } from './repositories/prisma/prisma-currency-rate-repository';
import { PrismaCurrencyHourRateRepository } from './repositories/prisma/prisma-currency-hour-rate-repository';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { createCurrency } from './helpers/createCurrency';
import { findAllCurrencies } from './helpers/findAllCurrencies';
import { updateCurrencyRates } from './helpers/updateCurrencyRates';
import { syncCurrencies } from './helpers/syncCurrencies';
import { findExchangeRate } from './helpers/findExchangeRate';
import {
  buildConverter,
  ConversionNeed,
  ConvertibleCurrency,
} from './helpers/buildConverter';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { FindExchangeRateQueryDto } from './dto/find-exchange-rate-query.dto';
import { DayRatesDto } from './dto/day-rates.dto';
import { findDayRates } from './helpers/findDayRates';

@Injectable()
export class CurrencyService {
  constructor(
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly rateRepository: PrismaCurrencyRateRepository,
    private readonly hourRateRepository: PrismaCurrencyHourRateRepository,
    private readonly appSettingService: AppSettingService,
  ) {}

  async create(dto: CreateCurrencyDto) {
    return createCurrency(dto, this.currencyRepository, await this.appSettingService.apiConfig('currency'));
  }

  async findAll() {
    return findAllCurrencies(this.currencyRepository);
  }

  async updateRates() {
    return updateCurrencyRates(this.currencyRepository, await this.appSettingService.apiConfig('currency'));
  }

  async exchangeRate(query: FindExchangeRateQueryDto) {
    const rate = await findExchangeRate(
      query.from,
      query.to,
      new Date(query.date),
      this.currencyRepository,
      this.rateRepository,
      () => this.appSettingService.apiConfig('currency'),
    );

    return { rate, date: query.date.slice(0, 10) };
  }

  /**
   * Um conversor para `target` (as finanças pessoais): pela hora das cotações de
   * cada registo, pela mais recente hoje e à frente, e pela do dia no resto.
   */
  converter(target: ConvertibleCurrency | null, needs: ConversionNeed[]) {
    return buildConverter(
      target,
      needs,
      this.rateRepository,
      this.hourRateRepository,
      () => this.appSettingService.apiConfig('currency'),
    );
  }

  dayRates(dto: DayRatesDto) {
    return findDayRates(dto, this.currencyRepository, (target, needs) =>
      this.converter(target, needs),
    );
  }

  async sync() {
    return syncCurrencies(this.currencyRepository, await this.appSettingService.apiConfig('currency'));
  }
}
