import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CountryRepository } from '../country-repository';
import { Country } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCountryRepository implements CountryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    apiId: string;
    name: string;
    iso2: string;
    iso3: string;
    phonecode: string;
    capital: string | null;
    currency: string;
    native: string | null;
    emoji: string | null;
  }): Promise<Country> {
    return this.prisma.country.upsert({
      where: { apiId: data.apiId },
      update: data,
      create: data,
    });
  }

  async findAll(): Promise<Country[]> {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string): Promise<Country | null> {
    return this.prisma.country.findUnique({ where: { id } });
  }
}
