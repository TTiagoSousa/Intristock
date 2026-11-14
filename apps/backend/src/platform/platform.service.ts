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
}
