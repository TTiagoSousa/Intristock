import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CurrencyRepository } from '../currency-repository';
import { Currency } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCurrencyRepository implements CurrencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    shortCode: string;
    code: string;
    precision: number;
    subunit: number;
    symbol: string;
    symbolFirst: boolean;
    decimalMark: string;
    thousandsSeparator: string;
    rate: number;
  }): Promise<Currency> {
    return this.prisma.currency.create({ data });
  }

  async upsert(data: {
    name: string;
    shortCode: string;
    code: string;
    precision: number;
    subunit: number;
    symbol: string;
    symbolFirst: boolean;
    decimalMark: string;
    thousandsSeparator: string;
    rate: number;
  }): Promise<Currency> {
    return this.prisma.currency.upsert({
      where: { shortCode: data.shortCode },
      update: data,
      create: data,
    });
  }

  async findAll(): Promise<Currency[]> {
    return this.prisma.currency.findMany({
      orderBy: { shortCode: 'asc' },
    });
  }

  async findByShortCode(shortCode: string): Promise<Currency | null> {
    return this.prisma.currency.findUnique({ where: { shortCode } });
  }

  async findById(id: string): Promise<Currency | null> {
    return this.prisma.currency.findUnique({ where: { id } });
  }

  async updateRate(id: string, rate: number): Promise<Currency> {
    return this.prisma.currency.update({ where: { id }, data: { rate } });
  }
}
