import { PrismaPlatformRepository } from '../repositories/prisma/prisma-platform-repository';

export async function findAllPlatforms(platformRepository: PrismaPlatformRepository) {
  return platformRepository.findAll();
}
