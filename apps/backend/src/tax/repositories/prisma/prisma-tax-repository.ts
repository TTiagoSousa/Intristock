import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TaxRepository } from '../tax-repository';
import { Tax } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaTaxRepository implements TaxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    countryId: string;
    name: string;
    description?: string;
    rate: number;
    category: string;
    type: string;
    isActive?: boolean;
  }): Promise<Tax> {
    return this.prisma.tax.create({ data });
  }

  async findById(id: string): Promise<Tax | null> {
    return this.prisma.tax.findUnique({ where: { id } });
  }

  async findAll(): Promise<Tax[]> {
    return this.prisma.tax.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { country: true },
    });
  }

  async findAllByCountryId(countryId: string): Promise<Tax[]> {
    return this.prisma.tax.findMany({
      where: { countryId, isActive: true },
      orderBy: { name: 'asc' },
      include: { country: true },
    });
  }
}
