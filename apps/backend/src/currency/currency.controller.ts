import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { FindExchangeRateQueryDto } from './dto/find-exchange-rate-query.dto';
import { DayRatesDto } from './dto/day-rates.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { UserThrottlerGuard } from 'src/common/throttle/user-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { DAY_RATES_LIMIT } from 'src/common/throttle/throttle.constants';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @Get()
  findAll() {
    return this.currencyService.findAll();
  }

  // Com sessão: uma cotação que ainda não está guardada gasta um pedido à API
  @Get('rate')
  @UseGuards(JwtUserAuthGuard)
  exchangeRate(@Query() query: FindExchangeRateQueryDto) {
    return this.currencyService.exchangeRate(query);
  }

  // As cotações do dia de vários valores de uma vez (os Registos das finanças pessoais)
  // Cada pedido pode gastar até 60 pedidos à CurrencyBeacon: limite por utilizador
  @Post('day-rates')
  @UseGuards(JwtUserAuthGuard, UserThrottlerGuard)
  @Throttle({ default: DAY_RATES_LIMIT })
  dayRates(@Body() dto: DayRatesDto) {
    return this.currencyService.dayRates(dto);
  }

  @Post('update-rates')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  updateRates() {
    return this.currencyService.updateRates();
  }

  @Post('sync')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  sync() {
    return this.currencyService.sync();
  }
}
