import { BadRequestException } from '@nestjs/common';
import { PrismaPlatformRepository } from '../repositories/prisma/prisma-platform-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { CreatePlatformDto } from '../dto/create-platform.dto';

export async function createPlatform(
  dto: CreatePlatformDto,
  platformRepository: PrismaPlatformRepository,
  countryRepository: PrismaCountryRepository,
) {
  if (dto.countryId) {
    const country = await countryRepository.findById(dto.countryId);

    if (!country) {
      throw new BadRequestException('País inválido');
    }
  }

  return platformRepository.create(dto);
}
