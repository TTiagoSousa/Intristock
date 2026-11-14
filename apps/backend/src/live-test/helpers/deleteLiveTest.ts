import { BadRequestException } from '@nestjs/common';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { findLiveTest } from './findLiveTest';
import { isActive } from './liveTestStatus';

// Apaga um teste que já parou, com os registos dele (um a correr pára-se primeiro)
export async function deleteLiveTest(
  userId: string,
  id: string,
  repository: PrismaLiveTestRepository,
) {
  const test = await findLiveTest(userId, id, repository);
  if (isActive(test.status)) {
    throw new BadRequestException('Para o teste antes de o apagar');
  }
  await repository.delete(id);
  return { id };
}
