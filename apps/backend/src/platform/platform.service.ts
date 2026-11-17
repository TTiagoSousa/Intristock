import { Injectable } from '@nestjs/common';
import { PrismaPlatformRepository } from './repositories/prisma/prisma-platform-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { createPlatform } from './helpers/createPlatform';
import { findAllPlatforms } from './helpers/findAllPlatforms';
import { CreatePlatformDto } from './dto/create-platform.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly platformRepository: PrismaPlatformRepository,
    private readonly countryRepository: PrismaCountryRepository,
  ) {}

  async create(dto: CreatePlatformDto) {
    return createPlatform(dto, this.platformRepository, this.countryRepository);
  }

  async findAll() {
    return findAllPlatforms(this.platformRepository);
  }

  /** Por plataforma, as ligações pela API (quantas e de quem), para a lista do admin. */
  async connections() {
    const byPlatform: Record<string, { count: number; users: { id: string; name: string; account: string; status: string }[] }> = {};
    for (const row of await this.platformRepository.findBrokerConnections()) {
      const entry = (byPlatform[row.platformId] ??= { count: 0, users: [] });
      entry.count += 1;
      entry.users.push({ id: row.user.id, name: row.user.fullName || row.user.email, account: row.externalAccountId, status: row.status });
    }
    return byPlatform;
  }
}
