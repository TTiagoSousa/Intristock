import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CurrencyRateRepository } from '../currency-rate-repository';
import { CurrencyRate } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCurrencyRateRepository implements CurrencyRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    date: Date,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<CurrencyRate | null> {
    return this.prisma.currencyRate.findUnique({
      where: {
        date_baseCurrencyId_quoteCurrencyId: {
          date,
          baseCurrencyId,
          quoteCurrencyId,
        },
      },
    });
  }

  async findMany(
    dates: Date[],
    baseCurrencyIds: string[],
    quoteCurrencyId: string,
  ): Promise<CurrencyRate[]> {
    if (!dates.length || !baseCurrencyIds.length) return [];
    return this.prisma.currencyRate.findMany({
      where: {
        date: { in: dates },
        baseCurrencyId: { in: baseCurrencyIds },
        quoteCurrencyId,
      },
    });
  }

  async save(
    date: Date,
    baseCurrencyId: string,
    quoteCurrencyId: string,
    rate: number,
  ): Promise<CurrencyRate> {
    return this.prisma.currencyRate.upsert({
      where: {
        date_baseCurrencyId_quoteCurrencyId: {
          date,
          baseCurrencyId,
          quoteCurrencyId,
        },
      },
      update: {},
      create: { date, baseCurrencyId, quoteCurrencyId, rate },
    });
  }
}
