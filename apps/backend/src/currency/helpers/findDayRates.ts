import { BadRequestException } from '@nestjs/common';
import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { DayRatesDto } from '../dto/day-rates.dto';
import {
  Converter,
  ConversionNeed,
  ConvertibleCurrency,
} from './buildConverter';

/**
 * Quanto vale 1 de cada moeda em `to` em cada dia pedido (pelo conversor das
 * finanças pessoais): `rates` por `${dia}|${moeda}`, com o dia já como o
 * conversor o usa (sem dia ou no futuro, hoje), e quantos foram pela cotação
 * de referência.
 */
export async function findDayRates(
  dto: DayRatesDto,
  currencyRepository: PrismaCurrencyRepository,
  converter: (
    target: ConvertibleCurrency,
    needs: ConversionNeed[],
  ) => Promise<Converter>,
) {
  const all = await currencyRepository.findAll();
  const byId = new Map(all.map((currency) => [currency.id, currency]));
  const target = byId.get(dto.to);
  if (!target) throw new BadRequestException('Moeda inválida');

  const today = new Date().toISOString().slice(0, 10);
  const dayOf = (day?: string) =>
    day && day.slice(0, 10) < today ? day.slice(0, 10) : today;
  const needs = dto.items
    .filter((item) => byId.has(item.from))
    .map((item) => ({ currency: byId.get(item.from)!, day: dayOf(item.day) }));
  const convert = await converter(target, needs);

  const rates: Record<string, number> = {};
  for (const need of needs)
    rates[`${need.day}|${need.currency.id}`] = convert.convert(
      1,
      need.currency,
      need.day,
    );
  return { to: target.id, today, rates, estimatedRates: convert.estimated() };
}
